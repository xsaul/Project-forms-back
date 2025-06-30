import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { Sequelize, DataTypes } from 'sequelize';


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// const db = mysql.createConnection(process.env.DATABASE_URL);
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql'
});

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userType: {
    type: DataTypes.STRING,
    defaultValue: 'Regular', 
  },
}, {
  tableName: 'usersform',
  timestamps: false,
});


app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: "User information is required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.json({
      message: "User registered successfully!",
      userId: newUser.id,
      userType: newUser.userType,
      name: newUser.name,
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and Password required" });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }

    res.json({
      message: "Login successful!",
      userId: user.id,
      name: user.name,
      userType: user.userType,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
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
app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
  console.log(`Server is running on port ${PORT}`);
})