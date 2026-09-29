import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { isClerkConfigured } from "./lib/account";
import { errorHandler, notFoundHandler } from "./lib/httpErrors";
import { logger } from "./lib/logger";
import { isOriginAllowed } from "./lib/origins";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => callback(null, !origin || isOriginAllowed(origin)),
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Sin claves de Clerk el servidor sigue atendiendo las rutas públicas;
// las rutas con sesión responden 401 hasta que se configuren.
if (isClerkConfigured()) {
  app.use(clerkMiddleware());
} else if (process.env.NODE_ENV !== "test") {
  logger.warn("Clerk keys are not configured; signed-in routes will respond 401");
}

app.use("/api", router);
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
