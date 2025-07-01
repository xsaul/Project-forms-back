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

const Template = sequelize.define('Template', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  topic: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  labels: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  questions: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  authorName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'templates',
  timestamps: false,
});

const Response = sequelize.define('Response', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  answers: {
    type: DataTypes.JSON,
    allowNull: false,
  },
}, {
  tableName: 'responses',
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
  try {
    await Template.create({
      title,
      description,
      topic,
      isPublic,
      labels,     
      questions,  
      authorName,
    });

    res.status(201).json({ message: "Template saved successfully" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.get("/getTemplates", async (req, res) => {
  try {
    const templates = await Template.findAll();
    if (!templates || templates.length === 0) {
      return res.status(404).json({ message: "No templates found" });
    }
    res.json(templates); 
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});


  app.get("/templates/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const template = await Template.findOne({ where: { id } });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    res.json(template);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/registerAnswers", async (req, res) => {
  const { userId, templateId, answers } = req.body;
  if (!userId || !templateId || !answers) {
    return res.status(400).json({ message: "The template information is not complete" });
  }
  try {
    await Response.create({
      userId,
      templateId,
      answers,
    });
    res.status(201).json({ message: "Answers saved successfully" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/userResponse", async (req, res) => {
  const { userId, templateId } = req.query;
  if (!userId || !templateId) {
    return res.status(400).json({ message: "Missing parameters" });
  }
  try {
    const response = await Response.findOne({ where: { userId, templateId } });
    if (!response) {
      return res.status(204).send();
    }
    res.json(response.answers);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.post("/editAnswers", async (req, res) => {
  const { userId, templateId, answers } = req.body;
  if (!userId || !templateId || !answers) {
    return res.status(400).json({ message: "Incomplete request body" });
  }
  try {
    const response = await Response.findOne({ where: { userId, templateId } });
    if (!response) {
      return res.status(404).json({ message: "Response not found" });
    }

    const updatedAnswers = {
      ...response.answers, 
      ...answers,
    };

    response.answers = updatedAnswers;
    await response.save();

    res.json({ message: "Answers updated successfully" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Update failed", error: err.message });
  }
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