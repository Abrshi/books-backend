-- 1. Users Table (for students and admins)
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100)  NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    behavior_score INT DEFAULT 5,
    role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

-- 2.departmentss Table
CREATE TABLE departments (
    departments_id INT PRIMARY KEY AUTO_INCREMENT,
    departments_name VARCHAR(100) NOT NULL,
    
);

-- 3. Materials Table
CREATE TABLE Materials (
    material_id INT PRIMARY KEY AUTO_INCREMENT,
    material_title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    departments_id INT,
    uploaded_by INT,
    FOREIGN KEY (departments_id) REFERENCES departmentss(departments_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- Cascade on delete and update
    FOREIGN KEY (uploaded_by) REFERENCES Users(user_id) ON DELETE SET NULL ON UPDATE CASCADE  -- Set uploaded_by to NULL if user is deleted, update cascades
);

-- 4. Comments Table
CREATE TABLE Comments (
    comment_id INT PRIMARY KEY AUTO_INCREMENT,
    material_id INT,
    user_id INT,
    comment_text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES Materials(material_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- Cascade on delete and update
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE  -- Cascade on delete and update
);

-- 5. Ratings Table
CREATE TABLE Ratings (
    rating_id INT PRIMARY KEY AUTO_INCREMENT,
    material_id INT,
    user_id INT,
    rating_value INT CHECK (rating_value BETWEEN 1 AND 5),  -- Rating scale 1-5
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES Materials(material_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- Cascade on delete and update
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE  -- Cascade on delete and update
);

-- 6. Favorites Table
CREATE TABLE Favorites (
    favorite_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    material_id INT,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- Cascade on delete and update
    FOREIGN KEY (material_id) REFERENCES Materials(material_id) ON DELETE CASCADE ON UPDATE CASCADE  -- Cascade on delete and update
);

-- 7. Activity Logs Table (with index on user_id)
CREATE TABLE Activity_Logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(255),  -- Description of the action (e.g., 'uploaded material', 'added comment')
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- Cascade on delete and update
    INDEX (user_id)  -- Add index for faster queries
);
