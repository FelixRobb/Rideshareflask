from flask import Flask, request, jsonify, g, render_template, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'fallback_secret_key')  # Use environment variable for secret key
CORS(app)

DATABASE = 'rideshare.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        with app.open_resource('schema.sql', mode='r') as f:
            db.cursor().executescript(f.read())
        db.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/api/check_session', methods=['GET'])
def check_session():
    user_id = session.get('user_id')
    name = session.get('name')
    if user_id:
        return jsonify({"user_id": user_id, "name": name}), 200
    return jsonify({"message": "Not logged in"}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    hashed_password = generate_password_hash(data['password'])
    try:
        cursor.execute('INSERT INTO users (phone_number, name, password) VALUES (?, ?, ?)',
                       (data['phone_number'], data['name'], hashed_password))
        db.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"message": "Phone number already exists"}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM users WHERE phone_number = ?', (data['phone_number'],))
    user = cursor.fetchone()
    if user and check_password_hash(user['password'], data['password']):
        session['user_id'] = user['id']
        session['name'] = user['name']
        session.permanent = True  # Make the session persistent
        app.permanent_session_lifetime = timedelta(days=30)  # Set session lifetime to 30 days
        return jsonify({"message": "Login successful", "user_id": user['id'], "name": user['name']}), 200
    return jsonify({"message": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logout successful"}), 200

@app.route('/api/add_contact', methods=['POST'])
def add_contact():
    data = request.json
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT id FROM users WHERE phone_number = ?', (data['contact_phone'],))
    contact = cursor.fetchone()
    if not contact:
        return jsonify({"message": "User not found"}), 404
    cursor.execute('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)',
                   (user_id, contact['id']))
    db.commit()
    add_notification(contact['id'], f"New contact request from user {user_id}", "contact_request", user_id)
    return jsonify({"message": "Contact request sent successfully"}), 201

@app.route('/api/get_contact_requests', methods=['GET'])
def get_contact_requests():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT c.id, u.name, u.phone_number, c.status
        FROM contacts c
        JOIN users u ON c.user_id = u.id
        WHERE c.contact_id = ? AND c.status = 'pending'
    ''', (user_id,))
    requests = cursor.fetchall()
    return jsonify([dict(r) for r in requests]), 200

@app.route('/api/respond_contact_request', methods=['POST'])
def respond_contact_request():
    data = request.json
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('UPDATE contacts SET status = ? WHERE id = ?', (data['status'], data['request_id']))
    db.commit()

    cursor.execute('SELECT user_id FROM contacts WHERE id = ?', (data['request_id'],))
    requester_id = cursor.fetchone()['user_id']
    add_notification(requester_id, f"Your contact request was {data['status']}", "contact_response", user_id)
    return jsonify({"message": "Contact request updated successfully"}), 200

@app.route('/api/create_ride_request', methods=['POST'])
def create_ride_request():
    data = request.json
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT INTO ride_requests (user_id, from_location, to_location, time, child_name) VALUES (?, ?, ?, ?, ?)',
                   (user_id, data['from_location'], data['to_location'], data['time'], data['child_name']))
    db.commit()
    return jsonify({"message": "Ride request created successfully"}), 201

@app.route('/api/offer_ride', methods=['POST'])
def offer_ride():
    data = request.json
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('UPDATE ride_requests SET offered_by = ? WHERE id = ?',
                   (user_id, data['ride_request_id']))
    db.commit()

    cursor.execute('SELECT user_id FROM ride_requests WHERE id = ?', (data['ride_request_id'],))
    requester_id = cursor.fetchone()['user_id']
    add_notification(requester_id, f"A ride has been offered for your request", "ride_offer", data['ride_request_id'])
    return jsonify({"message": "Ride offered successfully"}), 200

@app.route('/api/get_ride_requests', methods=['GET'])
def get_ride_requests():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT r.*, u.name as requester_name
        FROM ride_requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.user_id IN (SELECT contact_id FROM contacts WHERE user_id = ? AND status = 'accepted')
        AND r.offered_by IS NULL
        AND r.time > ?
    ''', (user_id, datetime.now().isoformat()))
    ride_requests = cursor.fetchall()
    return jsonify([dict(r) for r in ride_requests]), 200

@app.route('/api/get_user_ride_requests', methods=['GET'])
def get_user_ride_requests():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT r.*, u.name as offered_by_name
        FROM ride_requests r
        LEFT JOIN users u ON r.offered_by = u.id
        WHERE r.user_id = ?
        AND r.time > ?
    ''', (user_id, datetime.now().isoformat()))
    ride_requests = cursor.fetchall()
    return jsonify([dict(r) for r in ride_requests]), 200

@app.route('/api/get_notifications', methods=['GET'])
def get_notifications():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    notifications = cursor.fetchall()
    return jsonify([dict(n) for n in notifications]), 200

@app.route('/api/mark_notification_read', methods=['POST'])
def mark_notification_read():
    data = request.json
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', (data['notification_id'], user_id))
    db.commit()
    return jsonify({"message": "Notification marked as read"}), 200

@app.route('/api/get_saved_contacts', methods=['GET'])
def get_saved_contacts():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    db = get_db()
    cursor = db.cursor()
    cursor.execute('''
        SELECT u.name, u.phone_number
        FROM contacts c
        JOIN users u ON c.contact_id = u.id
        WHERE c.user_id = ? AND c.status = 'accepted'
    ''', (user_id,))
    contacts = cursor.fetchall()
    return jsonify([dict(c) for c in contacts]), 200

@app.route('/api/update_account', methods=['POST'])
def update_account():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Not logged in"}), 401

    data = request.json
    db = get_db()
    cursor = db.cursor()

    if 'password' in data:
        hashed_password = generate_password_hash(data['password'])
        cursor.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_password, user_id))
        db.commit()

    if 'name' in data:
        cursor.execute('UPDATE users SET name = ? WHERE id = ?', (data['name'], user_id))
        db.commit()

    return jsonify({"message": "Account updated successfully"}), 200

def add_notification(user_id, message, type, related_id):
    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT INTO notifications (user_id, message, type, related_id) VALUES (?, ?, ?, ?)',
                   (user_id, message, type, related_id))
    db.commit()

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=False)  # Set debug to False in production