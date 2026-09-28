import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";

const router: IRouter = Router();

/**
 * GET /api/universita
 * Returns a list of university names.
 */
router.get("/", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("universita")
      .select("nome")
      .order("nome");

    if (error) {
      throw error;
    }

    // Return array of objects with nome property, or just array of strings?
    // The frontend expects an array of strings for the dropdown options.
    // We'll return an array of strings for simplicity.
    const universityNames = data.map((uni) => uni.nome);
    res.json(universityNames);
  } catch (error) {
    console.error("Error fetching universities:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;