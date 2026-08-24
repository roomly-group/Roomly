import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomlyRouter from "./roomly";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomlyRouter);

export default router;
