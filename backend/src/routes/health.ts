import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { API_ROUTE_PATHS } from "@workspace/api-zod";

const router: IRouter = Router();

router.get(API_ROUTE_PATHS.HEALTH, (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
