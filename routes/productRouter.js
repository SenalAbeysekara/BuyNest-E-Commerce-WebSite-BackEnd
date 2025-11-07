import express from "express";
import {
  deleteProduct,
  getProducts,
  getProductById,
  getProductsByCategory,
  saveProduct,
  updateProduct,
  searchProducts,
  notifySupplier
} from "../controllers/productController.js";

const productRouter = express.Router();

productRouter.post("/notify", notifySupplier);
productRouter.get("/search", searchProducts);
productRouter.post("/", saveProduct);
productRouter.get("/", getProducts);
productRouter.post("/category", getProductsByCategory);
productRouter.put("/:productId", updateProduct);
productRouter.delete("/:productId", deleteProduct);
productRouter.get("/:productId", getProductById);

export default productRouter;
