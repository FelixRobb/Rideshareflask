CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    contact_id INTEGER,
    status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (contact_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS ride_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    time TEXT NOT NULL,
    child_name TEXT NOT NULL,
    offered_by INTEGER,
    status TEXT CHECK(status IN ('pending', 'accepted', 'completed', 'cancelled')) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (offered_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    related_id INTEGER,
    is_read BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact_id ON contacts (contact_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_user_id ON ride_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_offered_by ON ride_requests (offered_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);