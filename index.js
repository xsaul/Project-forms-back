import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection(process.env.DATABASE_URL);

function handleTablesError(err, results) {
  if (err) {
    console.error("Something went wrong:", err);
  } else {
    console.log("Table created successfully or already exists.");
  }
}

const createUsersForm =  `CREATE TABLE IF NOT EXISTS usersform (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     email VARCHAR(255) NOT NULL UNIQUE,
     password VARCHAR(255) NOT NULL,
     userType VARCHAR(255) NOT NULL DEFAULT 'Regular'
   );`;
const createTemplates = `CREATE TABLE IF NOT EXISTS templates (
     id INT AUTO_INCREMENT PRIMARY KEY,
     title VARCHAR(255),
     description TEXT,
     topic VARCHAR(255),
     isPublic TINYINT(1),
     labels JSON,
     questions JSON,
     authorName VARCHAR(255)
   );`;
const createResponses = `CREATE TABLE IF NOT EXISTS responses (
     id INT AUTO_INCREMENT PRIMARY KEY,
     userId INT,
     templateId INT,
     answers JSON,
     FOREIGN KEY (userId) REFERENCES usersform(id),
     FOREIGN KEY (templateId) REFERENCES templates(id)
   );`;

db.query(createUsersForm, handleTablesError);
db.query(createTemplates, handleTablesError);
db.query(createResponses, handleTablesError);

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Email and Password required" });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
  "INSERT INTO usersform (name, email, password) VALUES (?, ?, ?)",
  [name, email, hashedPassword],
  (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(
      "SELECT id, userType FROM usersform WHERE id = ?",
      [result.insertId],
      (err, userResult) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          message: "User registered successfully!",
          userId: userResult[0].id,
          userType: userResult[0].userType,
          name: name,
        });
      }
    );
  }
);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password required" });
  }
  db.query("SELECT * FROM usersform WHERE email = ?", [email], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }
    const user = result[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }
    res.json({ message: "Login successful!", userId: user.id, name: user.name, userType: user.userType });
  });
});

app.post("/registerTemplate", async (req, res) => {
  const { title, description, topic, isPublic, labels, questions, authorName } = req.body;
  if (!title || !description || !topic || typeof isPublic !== "boolean" || !labels || !questions || !authorName) {
    return res.status(400).json({ message: "The template information is not complete" });
  }

  const stringifiedLabels = JSON.stringify(labels);
  const stringifiedQuestions = JSON.stringify(questions);

  db.query(
  "INSERT INTO templates (title, description, topic, isPublic, labels, questions, authorName) VALUES (?, ?, ?, ?, ?, ?, ?)",
  [title, description, topic, isPublic, stringifiedLabels, stringifiedQuestions, authorName],
  (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ message: "Template saved successfully" });
  }
);
});

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

app.get("/getTemplates", async (req, res) => {
  db.query("SELECT * FROM templates", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(404).json({ message: "No templates found" });
    }
    const templates = results.map(template => ({
      ...template,
      labels: safeParse(template.labels),
  questions: safeParse(template.questions)
    }));
    res.json(templates);
  });});

  app.get("/templates/:id", async (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM templates WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!result) {
      return res.status(404).json({ message: "No template data found" });
    }
    const template = result[0];
    const parsedTemplate = {
      ...template,
      labels: safeParse(template.labels),
      questions: safeParse(template.questions)
    };
    res.json(parsedTemplate);
  });
});

app.post("/registerAnswers", async (req, res) => {
  const { userId, templateId, answers } = req.body;
  if (!userId || !templateId || !answers) {
    return res.status(400).json({ message: "The template information is not complete" });
  }
  const stringifiedAnswers = JSON.stringify(answers);
  db.query(
  "INSERT INTO responses (userId, templateId, answers) VALUES (?, ?, ?)",
  [userId, templateId, stringifiedAnswers],
  (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    res.status(201).json({ message: "Answers saved successfully" });
  }
);
});

app.get("/userResponse", (req, res) => {
  const { userId, templateId } = req.query;
  if (!userId || !templateId) {
    return res.status(400).json({ message: "Missing parameters" });
  }
  db.query(
    "SELECT answers FROM responses WHERE userId = ? AND templateId = ?",
    [userId, templateId],
    (err, results) => {
      if (err) {
        console.error("DB error:", err.message);
        return res.status(500).json({ message: "Server error", error: err.message });
      }
      if (results.length === 0) {
        return res.status(204).send();
      }
      try {
        return res.json(results[0].answers);
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr.message);
        return res.status(500).json({ message: "Invalid JSON stored in answers" });
      }
    }
  );
});

app.post("/editAnswers", (req, res) => {
  const { userId, templateId, answers } = req.body;
  if (!userId || !templateId || !answers) {
    return res.status(400).json({ message: "Incomplete request body" });
  }
  db.query(
    "SELECT answers FROM responses WHERE userId = ? AND templateId = ?",
    [userId, templateId],
    (err, results) => {
      if (err) {
        console.error("DB fetch error:", err.message);
        return res.status(500).json({ message: "Server error" });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: "Response not found" });
      }
      const currentAnswers = results[0].answers;
      const updatedAnswers = { ...currentAnswers, ...answers };
      const stringifiedAnswers = JSON.stringify(updatedAnswers);
      db.query(
        "UPDATE responses SET answers = ? WHERE userId = ? AND templateId = ?",
        [stringifiedAnswers, userId, templateId],
        (updateErr) => {
          if (updateErr) {
            console.error("Update error:", updateErr.message);
            return res.status(500).json({ message: "Update failed" });
          }
          res.json({ message: "Answers updated successfully" });
        }
      );
    }
  );
});

const PORT = process.env.PORT || 3306;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));