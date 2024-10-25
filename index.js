const express = require('express');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
// for google drive
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' }); // Temporary storage for google drive

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// 1. Create a new user (either student or admin)
app.post('/register', async (req, res) => {
    const { name, email, password, role = 'user' } = req.body;

    if (!password) {
        return res.status(400).send('Password is required');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `INSERT INTO Users (username, email, password, role) VALUES (?, ?, ?, ?)`;

    db.query(query, [name, email, hashedPassword, role], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('User created successfully');
        }
    });
});

// 2. Create a new course
app.post('/courses', (req, res) => {
    const { course_name, course_category, description } = req.body;
    const query = `INSERT INTO Courses (course_name, course_category, description) VALUES (?, ?, ?)`;

    db.query(query, [course_name, course_category, description], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('Course created successfully');
        }
    });
});

// 3. Login and JWT generation
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    db.query('SELECT * FROM Users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(400).send(err);
        if (results.length === 0) return res.status(404).send('User not found');

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).send('Invalid credentials');

        // Generate JWT token
        // const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
        //     expiresIn: '1h',
        // });

        // res.json({ token, username: user.username });
         res.json({ username: user.username ,role:user.role , behavior_score:user.behavior_score ,email:user.email ,user_id:user.user_id});
    });
});

// 4. Upload a new material
const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    app.post('/upload', upload.single('file'), async (req, res) => {
        try {
            const { selectedDipartment, user } = req.body;
            const file = req.file;
    
            if (!file) {
                return res.status(400).send('No file uploaded.');
            }
    
            // Fetch department ID
            const departmentQuery = 'SELECT department_id FROM departments WHERE department_name = ?';
            const [departmentResults] = await db.promise().query(departmentQuery, [selectedDipartment]);
            const departmentId = departmentResults.length > 0 ? departmentResults[0].department_id : null;
    
            if (departmentId === null) {
                return res.status(404).send('Department not found.');
            }
    
            // Fetch user ID
            const userIdQuery = 'SELECT user_id FROM users WHERE username = ?';
            const [userIdResults] = await db.promise().query(userIdQuery, [user]);
            const userId = userIdResults.length > 0 ? userIdResults[0].user_id : null;
    
            if (userId === null) {
                return res.status(404).send('User not found.');
            }
    
            // Prepare file upload metadata and media
            const fileMetadata = {
                name: file.originalname,
            };
            const media = {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path),
            };
    
            // Upload file to Google Drive
            const driveResponse = await drive.files.create({
                resource: fileMetadata,
                media,
                fields: 'id',
            });
    
            // Set permissions to make the file accessible
            await drive.permissions.create({
                fileId: driveResponse.data.id,
                requestBody: {
    role: 'reader',
                    type: 'anyone',
                },
            });
    
            // Generate download link
            const filePath = `https://drive.google.com/uc?export=download&id=${driveResponse.data.id}`;
    
            // Insert file details into the database
            const uploadDate = new Date();
            const insertQuery = 'INSERT INTO materials (material_title, file_path, department_id, uploaded_by) VALUES (?, ?, ?, ?)';
            const inserts = [file.originalname, filePath, departmentId, userId];
            await db.promise().query(insertQuery, inserts);
    
            // Clean up temporary file
            fs.unlinkSync(file.path);
    
            res.status(200).send('File uploaded and saved.');
        } catch (err) {
            console.error('Error:', err);
            res.status(500).send('An error occurred during upload.');
        }
    });
    


// 5. Add a comment to a material
app.post('/comments', (req, res) => {
    const { material_id, user_id, comment_text } = req.body;
    const query = `INSERT INTO Comments (material_id, user_id, comment_text) VALUES (?, ?, ?)`;

    db.query(query, [material_id, user_id, comment_text], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('Comment added successfully');
        }
    });
});

// 6. Rate a material
app.post('/ratings', (req, res) => {
    const { material_id, user_id, rating_value } = req.body;
    if (rating_value < 1 || rating_value > 5) {
        return res.status(400).send('Rating must be between 1 and 5');
    }
    const query = `INSERT INTO Ratings (material_id, user_id, rating_value) VALUES (?, ?, ?)`;

    db.query(query, [material_id, user_id, rating_value], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('Rating added successfully');
        }
    });
});

// 7. Add a material to favorites
app.post('/favorites', (req, res) => {
    const { user_id, material_id } = req.body;
    const query = `INSERT INTO Favorites (user_id, material_id) VALUES (?, ?)`;

    db.query(query, [user_id, material_id], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('Material added to favorites');
        }
    });
});

// 8. add Dipartment

app.post('/dipartment', (req, res) => {
    const { dipartment_name } = req.body;
    console.log('Department name:', dipartment_name); // Log incoming data

    const query = `INSERT INTO departments (department_name) VALUES (?)`;
    
    db.query(query, [dipartment_name], (err, result) => {
        if (err) {
            console.error('Database error:', err); // Log any SQL error
            return res.status(500).send({ error: err.message });
        } else {
            res.send('Department added successfully');
        }
    });
});


// 9. Log user activity
app.post('/logs', (req, res) => {
    const { user_id, action } = req.body;
    const query = `INSERT INTO Activity_Logs (user_id, action) VALUES (?, ?)`;

    db.query(query, [user_id, action], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('User activity logged');
        }
    });
});


app.patch('/addadmin', async (req, res) => {
    const { email, position } = req.body;
    console.log(email);
    console.log(position);
    

    const query = `UPDATE Users SET role = ? WHERE email = ?`;

    db.query(query, [position, email], (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send('User role updated successfully');
        }
        
    });
});



// 10 retrive the department
app.get('/dipartments', (req, res) => {
    const query = 'SELECT * FROM departments';
    
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results);
        }
    });
});

// 10 retrive the department
app.get('/users', (req, res) => {
    const query = 'SELECT * FROM users';
    

    db.query(query, (err, results) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.json(results);
        }
    });
});

//////////////////////////////////////////////////////////
// Retrieve uploaded files
app.get('/materials', async (req, res) => {
    try {
        const query = 'SELECT * FROM materials'; // Adjust this query to fit your needs
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error fetching materials:', err);
                return res.status(500).send('Error fetching materials.');
            }

            // Send results back to client
            res.status(200).json(results);
        });
    } catch (error) {
        console.error('Error retrieving materials:', error);
        res.status(500).send('Error retrieving materials.');
    }
});


// Server setup
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});