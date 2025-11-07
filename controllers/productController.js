import Product from "../models/product.js";
import { isAdmin } from "./userController.js";
import Supplier from "../models/supplier.js";  
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function saveProduct(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ message: "Unauthorized" });

  try {
    const raw = (req.body.productId || "").trim();
    if (!raw) return res.status(400).json({ message: "productId is required" });

    if (!/^\d+$/.test(raw)) {
      return res.status(400).json({ message: "productId must contain digits only" });
    }

    const newProductId = "BYNPD" + raw.padStart(5, "0");

    const existing = await Product.findOne({ productId: newProductId });
    if (existing) {
      return res.status(400).json({ message: "productId already exists" });
    }

    const product = new Product({
      productId: newProductId,
      name: req.body.name,
      categories: req.body.categories,
      description: req.body.description,
      images: req.body.images,
      labelledPrice: req.body.labelledPrice,
      price: req.body.price,
      stock: req.body.stock,
      isAvailable: req.body.isAvailable
    });

    await product.save();
    res.json({ message: "Product added successfully" });

  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: "productId already exists" });
    }
    console.error("Save error:", err);
    res.status(500).json({ message: "Failed to add product", error: err.message });
  }
}

export async function getProducts(req, res) {
    try {
        if (isAdmin(req)) {
            const products = await Product.find();
            res.json(products);
        } else {
            const products = await Product.find({ isAvailable: true });
            res.json(products);
        }
    } catch (err) {
        res.json({
            message: "Failed to get products",
            error: err
        });
    }
}

export async function searchProducts(req, res) {
  try {
    const query = req.query.query || "";   
    if (!query) return res.json([]);

    const searchRegex = new RegExp(query, "i");

    const products = isAdmin(req)
      ? await Product.find({ name: searchRegex })
      : await Product.find({ name: searchRegex, isAvailable: true });

    res.json(products);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
}

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getProductsByCategory(req, res) {
    try {
        const category = req.body.category;

        if (!category) {
            return res.status(400).json({ message: "Category is required" });
        }
        
       
        let products;
        const query = { categories: { $regex: new RegExp(`^${category}$`, "i") } };

        if (isAdmin(req)) {
            products = await Product.find(query);
        } else {
            products = await Product.find({ ...query, isAvailable: true });
        }

        res.json(products);
    } catch (err) {
        console.error("Category fetch error:", err);
        res.status(500).json({
            message: "Failed to get products by category",
            error: err.message,
        });
    }
}


export async function deleteProduct(req, res) {
    if (!isAdmin(req)) {
        res.status(403).json({
            message: "You are not authorized to delete a product"
        });
        return;
    }

    try {
        await Product.deleteOne({ productId: req.params.productId });
        res.json({
            message: "Product deleted successfully"
        });
    } catch (err) {
        res.status(500).json({
            message: "Failed to delete product",
            error: err
        });
    }
}

export async function updateProduct(req, res) {
    if (!isAdmin(req)) {
        res.status(403).json({
            message: "You are not authorized to update a product"
        });
        return;
    }

    const productId = req.params.productId;
    const updatingData = req.body;

    try {
        await Product.updateOne({ productId }, updatingData);
        res.json({ message: "Product updated successfully" });
    } catch (err) {
        res.status(500).json({
            message: "Internal server error",
            error: err
        });
    }
}

async function sendMail({ to, subject, html }) {
  const from = process.env.SENDGRID_FROM;

  const msg = {
    to,
    from,
    subject,
    html,
    text: html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim(),
  };

  const [resp] = await sgMail.send(msg);
  if (resp.statusCode !== 202) {
    throw new Error(`SendGrid failed with status ${resp.statusCode}`);
  }
  return resp;
}

export async function notifySupplier(req, res) {
  try {
    const { productId } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const supplier = await Supplier.findOne({ productId });
    if (!supplier) {
      return res.status(404).json({ message: "No supplier linked to this product" });
    }

    const msg = `
      <div style="
        font-family: 'Segoe UI', Roboto, sans-serif;
        background-color: #f8fafc;
        padding: 20px;
        border-radius: 10px;
        color: #333;
        max-width: 600px;
        margin: auto;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      ">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #059669; margin: 0;">BuyNest Inventory Alert</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Automated Supplier Notification</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        </div>

        <p>Dear <strong>${supplier.Name}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6;">
          This is an automated notice from the <b>BuyNest Inventory System</b>.
          The following product has reached a low stock level:
        </p>

        <div style="
          background-color: #ecfdf5;
          border-left: 4px solid #10b981;
          padding: 12px 16px;
          margin: 16px 0;
          border-radius: 6px;
        ">
          <p style="margin: 4px 0;"><b>Product Name:</b> ${product.name}</p>
          <p style="margin: 4px 0;"><b>Product ID:</b> ${product.productId}</p>
          <p style="margin: 4px 0; color: #b91c1c;"><b>Current Stock:</b> ${product.stock}</p>
        </div>

        <p style="font-size: 15px; line-height: 1.6;">
          Please arrange a <b>resupply</b> at the earliest convenience to avoid stock-out situations.
        </p>

        <div style="margin-top: 24px; text-align: center; font-size: 13px; color: #64748b;">
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-bottom: 12px;" />
          <p style="margin: 0;">Thank you,</p>
          <p style="font-weight: 600; color: #059669; margin: 4px 0;">BuyNest Inventory Management System</p>
          <p style="margin: 0;">Efficient. Reliable. Connected.</p>
        </div>
      </div>
    `;

    await sendMail({
      to: supplier.email,
      subject: `Resupply Request: ${product.name}`,
      html: msg,
    });

    res.json({ message: "Email sent to supplier successfully" });
  } catch (err) {
    console.error("Notify Supplier Error:", err);
    res.status(500).json({ message: "Failed to notify supplier", error: err.message });
  }
}
