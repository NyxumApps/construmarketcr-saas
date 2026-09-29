import { Router, type IRouter } from "express";
import healthRouter from "./health";
import validationRouter from "./validation";
import commerceRouter from "./commerce";

const router: IRouter = Router();

router.use(healthRouter);
router.use(validationRouter);
router.use(commerceRouter);

export default router;
