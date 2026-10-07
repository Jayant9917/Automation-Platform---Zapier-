import { Router } from "express";
import { authMiddleware } from "../middleware.js";
import { ZapCreateSchema } from "../types.js";
import { prismaClient } from "../db/index.js";
import type { Prisma } from "@prisma/client";

const router = Router();

router.post("/", authMiddleware, async (req, res) => {
    const id = req.id;
    if (id === undefined || id === null) {
        return res.status(403).json({
            message: "Unauthorized"
        });
    }
    const userId = typeof id === "number" ? id : parseInt(String(id), 10);
    if (Number.isNaN(userId) || userId < 1) {
        return res.status(403).json({
            message: "Invalid user"
        });
    }

    const body = req.body;
    const parsedData = ZapCreateSchema.safeParse(body);
    
    if (!parsedData.success) {
        return res.status(411).json({
            message: "Incorrect inputs"
        });
    }   

    const zapId = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
        const zap = await tx.zap.create({
            data: {
                user: { connect: { id: userId } },
                triggerId: "",
                actions: {
                    create: parsedData.data.actions.map((x: { availableActionId: string; actionMetadata: Record<string, unknown> }, index: number) => ({
                        actionId: x.availableActionId,
                        sortingOrder: index,
                        Metadata: x.actionMetadata
                    }))
                }
            }
        })

        const trigger = await tx.trigger.create({
            data: {
                type: { connect: { id: parsedData.data.availableTriggerId } },
                zap: { connect: { id: zap.id } },
            }
        });

        await tx.zap.update({
            where: {
                id: zap.id
            },
            data: {
                triggerId: trigger.id
            }
        })

        return zap.id;

    })
    return res.json({
        zapId
    })
})

router.get("/", authMiddleware, async (req, res) => {
    const id = req.id;
    if (!id) {
        return res.status(403).json({
            message: "Unauthorized"
        });
    }
    
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
        return res.status(400).json({
            message: "Invalid user ID"
        });
    }
    
    const zaps = await prismaClient.zap.findMany({
        where: {
             userId: userId
        },
        include: {
            actions: {
               include: {
                    type: true
               }
            },
            trigger: {
                include: {
                    type: true
                }
            }
        }
    });

    return res.json({
        zaps
    })
})

router.get("/:zapId", authMiddleware, async (req, res) => {
    const id = req.id;
    if (!id) {
        return res.status(403).json({
            message: "Unauthorized"
        });
    }
    
    const zapId = Array.isArray(req.params.zapId) ? req.params.zapId[0] : req.params.zapId;
    
    if (!zapId || typeof zapId !== "string") {
        return res.status(411).json({
            message: "Invalid zap ID"
        });
    }

    const zap = await prismaClient.zap.findFirst({
        where: {
            id: zapId,
            userId: parseInt(id, 10)
        },
        include: {
            actions: {
               include: {
                    type: true
               }
            },
            trigger: {
                include: {
                    type: true
                }
            }
        }
    });

    return res.json({
        zap
    })

})

export const zapRouter = router;