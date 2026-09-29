import { Router, type IRouter } from "express";
import healthRouter from "./health";
import validationRouter from "./validation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(validationRouter);

export default router;
