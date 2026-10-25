import dotenv from "dotenv";
dotenv.config();
import app from "./server/app.js";
import { configurePush } from "./server/services.js";

configurePush();
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API local escuchando en http://localhost:${port}`));
