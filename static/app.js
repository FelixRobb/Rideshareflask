let userId = null;
let userName = null;

function showLoginForm() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

function showRegisterForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function showMainPage() {
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('main').classList.remove('hidden');
    loadRideRequests();
    loadUserRideRequests();
    loadSavedContacts();
    loadContactRequests();
    loadNotifications();
}

function checkSession() {
    fetch('/api/check_session')
    .then(response => response.json())
    .then(data => {
        if (data.user_id) {
            userId = data.user_id;
            userName = data.name;
            showMainPage();
        } else {
            showLoginForm();
        }
    })
    .catch(() => {
        showLoginForm();
    });
}

function register(event) {
    event.preventDefault();
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const name = document.getElementById('registerName').value;
    fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, password: password, name: name })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === "User registered successfully") {
            alert('Registration successful. Please login.');
            showLoginForm();
        } else {
            alert(data.message);
        }
    });
}

function login(event) {
    event.preventDefault();
    const phone = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPassword').value;
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.user_id) {
            userId = data.user_id;
            userName = data.name;
            showMainPage();
        } else {
            alert(data.message);
        }
    });
}

function logout() {
    fetch('/api/logout', { method: 'POST' })
    .then(response => response.json())
    .then(data => {
        userId = null;
        userName = null;
        document.getElementById('auth').classList.remove('hidden');
        document.getElementById('main').classList.add('hidden');
        showLoginForm();
    });
}

function loadSavedContacts() {
    fetch('/api/get_saved_contacts')
    .then(response => response.json())
    .then(contacts => {
        const contactsDiv = document.getElementById('savedContacts');
        contactsDiv.innerHTML = '';
        contacts.forEach(contact => {
            const contactDiv = document.createElement('div');
            contactDiv.className = 'contact';
            contactDiv.innerHTML = `
                <p><strong>${contact.name}</strong> (${contact.phone_number})</p>
                <button onclick="removeContact('${contact.phone_number}')">Remove Contact</button>
            `;
            contactsDiv.appendChild(contactDiv);
        });
    });
}

function addContact(event) {
    event.preventDefault();
    const contactPhone = document.getElementById('contactPhone').value;
    fetch('/api/add_contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_phone: contactPhone })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadSavedContacts();
        loadContactRequests();
    });
}

function removeContact(contactPhone) {
    if (confirm('Are you sure you want to remove this contact?')) {
        fetch('/api/remove_contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_id: contactPhone })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            loadSavedContacts();
        });
    }
}

function loadContactRequests() {
    fetch('/api/get_contact_requests')
    .then(response => response.json())
    .then(requests => {
        const requestsDiv = document.getElementById('contactRequests');
        if (requestsDiv) {
            requestsDiv.innerHTML = '';
            if (requests.length === 0) {
                requestsDiv.innerHTML = '<p>No pending contact requests.</p>';
            } else {
                requests.forEach(request => {
                    const requestDiv = document.createElement('div');
                    requestDiv.className = 'contact-request';
                    requestDiv.innerHTML = `
                        <p><strong>${request.name}</strong> (${request.phone_number}) wants to connect</p>
                        <button onclick="respondToContactRequest(${request.id}, 'accepted')">Accept</button>
                        <button onclick="respondToContactRequest(${request.id}, 'rejected')">Reject</button>
                    `;
                    requestsDiv.appendChild(requestDiv);
                });
            }
        }
    });
}

function respondToContactRequest(requestId, status) {
    fetch('/api/respond_contact_request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, status: status })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadContactRequests();
        loadSavedContacts();
    });
}

function updateAccount(event) {
    event.preventDefault();
    const newName = document.getElementById('updateName').value;
    const newPassword = document.getElementById('updatePassword').value;
    
    const body = {};
    if (newName) body.name = newName;
    if (newPassword) body.password = newPassword;
    
    fetch('/api/update_account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadSavedContacts();
    });
}

function refreshUserRideRequests() {
    loadUserRideRequests();
}

function loadRideRequests() {
    fetch('/api/get_ride_requests')
    .then(response => response.json())
    .then(rideRequests => {
        const rideRequestsDiv = document.getElementById('availableRideRequests');
        rideRequestsDiv.innerHTML = '';
        rideRequests.forEach(request => {
            const requestDiv = document.createElement('div');
            requestDiv.className = 'ride-request';
            requestDiv.innerHTML = `
                <p><strong>From:</strong> ${request.from_location}</p>
                <p><strong>To:</strong> ${request.to_location}</p>
                <p><strong>Time:</strong> ${new Date(request.time).toLocaleString()}</p>
                <p><strong>Child:</strong> ${request.child_name}</p>
                <p><strong>Requester:</strong> ${request.requester_name}</p>
                <button onclick="offerRide(${request.id})">Offer Ride</button>
            `;
            rideRequestsDiv.appendChild(requestDiv);
        });
    });
}

function loadUserRideRequests() {
    fetch('/api/get_user_ride_requests')
    .then(response => response.json())
    .then(rideRequests => {
        const userRideRequestsDiv = document.getElementById('userRideRequests');
        userRideRequestsDiv.innerHTML = '';
        if (rideRequests.length === 0) {
            userRideRequestsDiv.innerHTML = '<p class="text-center text-gray-500">You haven\'t made any ride requests yet.</p>';
        } else {
            rideRequests.forEach(request => {
                const requestDiv = document.createElement('div');
                requestDiv.className = 'ride-request card mb-4';
                requestDiv.innerHTML = `
                    <p><strong>From:</strong> ${request.from_location}</p>
                    <p><strong>To:</strong> ${request.to_location}</p>
                    <p><strong>Time:</strong> ${new Date(request.time).toLocaleString()}</p>
                    <p><strong>Child:</strong> ${request.child_name}</p>
                    <p><strong>Status:</strong> ${request.offered_by ? 'Offered by ' + request.offered_by_name : 'Waiting for offers'}</p>
                `;
                userRideRequestsDiv.appendChild(requestDiv);
            });
        }
    })
    .catch(error => {
        console.error('Error loading user ride requests:', error);
        const userRideRequestsDiv = document.getElementById('userRideRequests');
        userRideRequestsDiv.innerHTML = '<p class="text-center text-red-500">Error loading ride requests. Please try again later.</p>';
    });
}

function createRideRequest(event) {
    event.preventDefault();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const time = document.getElementById('time').value;
    const childName = document.getElementById('childName').value;

    fetch('/api/create_ride_request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_location: from, to_location: to, time: time, child_name: childName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === "Ride request created successfully") {
            alert(data.message);
            loadUserRideRequests();
            showTab('rideRequests');
        } else {
            alert(data.message);
        }
    });
}

function offerRide(rideRequestId) {
    fetch('/api/offer_ride', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_request_id: rideRequestId })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        loadRideRequests();
    });
}

function loadNotifications() {
    fetch('/api/get_notifications')
    .then(response => response.json())
    .then(notifications => {
        const notificationsDiv = document.getElementById('notificationList');
        notificationsDiv.innerHTML = '';
        notifications.forEach(notification => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = `notification ${notification.is_read ? '' : 'unread'}`;
            notificationDiv.innerHTML = `
                <p>${notification.message}</p>
                <p><small>${new Date(notification.created_at).toLocaleString()}</small></p>
            `;
            notificationDiv.onclick = () => markNotificationAsRead(notification.id);
            notificationsDiv.appendChild(notificationDiv);
        });
    });
}

function markNotificationAsRead(notificationId) {
    fetch('/api/mark_notification_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId })
    })
    .then(response => response.json())
    .then(data => {
        loadNotifications();
    });
}

function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');

    const buttons = document.querySelectorAll('nav button');
    buttons.forEach(button => button.classList.remove('active'));
    event.target.classList.add('active');

    if (tabId === 'contacts') {
        loadSavedContacts();
        loadContactRequests();
    } else if (tabId === 'rideRequests') {
        loadRideRequests();
        loadUserRideRequests();
    }
}

document.addEventListener("DOMContentLoaded", checkSession);

setInterval(loadNotifications, 30000);