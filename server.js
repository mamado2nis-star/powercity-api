const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase Setup
const SUPABASE_URL = 'https://fysnqbrvcmftqzdgogjz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5c25xYnJ2Y21mdHF6ZGdvZ2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNjk3NjQsImV4cCI6MjA5MjY0NTc2NH0.CQjCs4o9GntW3ZTiLlN-WTYAf4mLaHVJsQ8ZDDmoP6s';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Users Data
const USERS = {
    'admin': { password: 'admin123', name: 'مدير النظام', role: 'admin' },
    'mohamed': { password: 'eng123', name: 'م. محمد', role: 'engineer' },
    'hany': { password: 'hany123', name: 'هاني', role: 'technician' },
    'reception': { password: 'rec123', name: 'الاستقبال', role: 'reception' }
};

// =====================================================
// AUTHENTICATION
// =====================================================
app.post('/api/login', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    
    if (USERS[username] && USERS[username].password === password) {
        res.json({
            success: true,
            user: {
                username: username,
                name: USERS[username].name,
                role: USERS[username].role
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
});

// =====================================================
// DASHBOARD
// =====================================================
app.get('/api/dashboard', async function(req, res) {
    try {
        var ticketsData = await supabase.from('tickets').select('*');
        var tickets = ticketsData.data || [];
        
        var workshop = 0, ready = 0, sales = 0, paid = 0;
        for (var i = 0; i < tickets.length; i++) {
            var t = tickets[i];
            if (t.status !== 'delivered') workshop++;
            if (t.status === 'ready') ready++;
            sales += parseFloat(t.final_cost) || 0;
            paid += parseFloat(t.paid_amount) || 0;
        }
        
        // Status counts
        var statuses = {};
        for (var i = 0; i < tickets.length; i++) {
            var status = tickets[i].status;
            statuses[status] = (statuses[status] || 0) + 1;
        }
        
        res.json({
            success: true,
            stats: {
                workshop: workshop,
                ready: ready,
                sales: sales,
                paid: paid,
                due: sales - paid
            },
            statuses: statuses,
            totalTickets: tickets.length
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// TICKETS
// =====================================================
app.get('/api/tickets', async function(req, res) {
    try {
        var query = supabase.from('tickets').select('*').order('created_at', { ascending: false });
        
        if (req.query.status && req.query.status !== 'all') {
            query = query.eq('status', req.query.status);
        }
        
        var result = await query;
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/tickets/:id', async function(req, res) {
    try {
        var result = await supabase.from('tickets').select('*').eq('id', req.params.id).single();
        res.json({ success: true, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/tickets', async function(req, res) {
    try {
        var lastTicket = await supabase.from('tickets').select('ticket_number').order('ticket_number', { ascending: false }).limit(1);
        var num = 1237;
        if (lastTicket.data && lastTicket.data.length > 0) {
            num = parseInt(lastTicket.data[0].ticket_number.replace('TK-', '')) + 1;
        }
        var ticketNo = 'TK-' + ('00000' + num).slice(-5);
        
        var newTicket = {
            ticket_number: ticketNo,
            customer_name: req.body.customer_name,
            device_type_name: req.body.device_type_name,
            brand_name: req.body.brand_name,
            device_model: req.body.device_model,
            serial_number: req.body.serial_number,
            fault_name: req.body.fault_name,
            notes: req.body.notes,
            status: 'received',
            final_cost: 0,
            paid_amount: 0,
            received_at: new Date().toISOString().split('T')[0]
        };
        
        var result = await supabase.from('tickets').insert([newTicket]);
        res.json({ success: true, ticketNumber: ticketNo, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.patch('/api/tickets/:id', async function(req, res) {
    try {
        var result = await supabase.from('tickets').update(req.body).eq('id', req.params.id);
        res.json({ success: true, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// DELIVERY
// =====================================================
app.get('/api/delivery', async function(req, res) {
    try {
        var result = await supabase.from('tickets').select('*').eq('status', 'ready').order('created_at', { ascending: false });
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/delivery/:id', async function(req, res) {
    try {
        var result = await supabase.from('tickets').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', req.params.id);
        res.json({ success: true, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// CUSTOMERS
// =====================================================
app.get('/api/customers', async function(req, res) {
    try {
        var result = await supabase.from('customers').select('*').order('name');
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/customers', async function(req, res) {
    try {
        var result = await supabase.from('customers').insert([req.body]);
        res.json({ success: true, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// PAYMENTS
// =====================================================
app.get('/api/payments', async function(req, res) {
    try {
        var result = await supabase.from('tickets').select('*').gt('paid_amount', 0).order('updated_at', { ascending: false }).limit(20);
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/payments', async function(req, res) {
    try {
        var ticketResult = await supabase.from('tickets').select('*').eq('ticket_number', req.body.ticket_number).single();
        if (!ticketResult.data) {
            return res.status(404).json({ success: false, message: 'التيكيت غير موجود' });
        }
        
        var newPaid = (parseFloat(ticketResult.data.paid_amount) || 0) + parseFloat(req.body.amount);
        var result = await supabase.from('tickets').update({ paid_amount: newPaid }).eq('id', ticketResult.data.id);
        
        res.json({ success: true, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// DROPDOWNS
// =====================================================
app.get('/api/device-types', async function(req, res) {
    try {
        var result = await supabase.from('device_types').select('*').order('name');
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/brands', async function(req, res) {
    try {
        var result = await supabase.from('brands').select('*').order('name');
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/faults', async function(req, res) {
    try {
        var result = await supabase.from('common_faults').select('*').order('name');
        res.json({ success: true, data: result.data || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =====================================================
// SERVER
// =====================================================
var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
    console.log('API Server running on port ' + PORT);
});
