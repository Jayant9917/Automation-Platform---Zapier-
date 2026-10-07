import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_PASSWORD } from "./config.js";

export function authMiddleware (req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || typeof authHeader !== "string") {
        return res.status(403).json({
            message: "You are not logged in"
        });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    if (!token || token === "null" || token === "undefined") {
        return res.status(403).json({
            message: "You are not logged in"
        });
    }
    try {
        const payload = jwt.verify(token, JWT_PASSWORD) as { id: number | string };
        const id = payload?.id;
        const userId = typeof id === "number" ? id : parseInt(String(id), 10);
        if (Number.isNaN(userId) || userId < 1) {
            return res.status(403).json({ message: "Invalid token" });
        }
        req.id = String(userId);
        next();
    } catch(e) {
        return res.status(403).json({
            message: "You are not logged in"
        });
    }
}