import express from "express";
import { getUserById, getAllUsers, getUsersBatch, updateUserRole} from "../controllers/internal.js";

const router = express.Router();

router.get("/users/:id", getUserById);
router.get("/users", getAllUsers);
router.post("/users/batch", getUsersBatch); 
router.patch("/users/:id/role", updateUserRole);

export default router;
