"use client";

import { useState, useEffect } from "react";

export default function SurplusForm() {
  const [menuItems, setMenuItems] = useState([]);
  const [isFree, setIsFree] = useState(false);

  const [formData, setFormData] = useState({
    menu_item_id: "",
    quantity: "",
    discounted_price: "",
    pickup_window_start: "",
    pickup_window_end: "",
  });

  useEffect(() => {
    fetchMenuItems();
  }, []);

  async function fetchMenuItems() {
    try {
      const response = await fetch("/api/surplus/menu-items");
      const data = await response.json();

      console.log("MENU ITEMS:", data);

      setMenuItems(data || []);
    } catch (error) {
      console.error("Failed to fetch menu items", error);
    }
  }

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const response = await fetch("/api/surplus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          discounted_price: isFree
            ? 0
            : Number(formData.discounted_price),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
  console.log(data);
  throw new Error(data.error || JSON.stringify(data));
}
      alert("Surplus listing created!");

      setFormData({
        menu_item_id: "",
        quantity: "",
        discounted_price: "",
        pickup_window_start: "",
        pickup_window_end: "",
      });

      setIsFree(false);

      window.location.reload();
    } catch (error) {
  console.error(error);
  alert(error.message);
}
  }

  return (
    <div className="card border border-border rounded-xl p-6 bg-surface">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
          Create Surplus Listing
        </h2>

        <p className="text-[var(--text-secondary)] mt-1">
          Publish surplus food items for community distribution.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid md:grid-cols-2 gap-6">

          {/* Menu Item */}
          <div>
            <label className="block mb-2 font-medium">
              Menu Item
            </label>

            <select
              name="menu_item_id"
              value={formData.menu_item_id}
              onChange={handleChange}
              className="w-full rounded-lg border border-border px-4 py-3 bg-background"
              required
            >
              <option value="">
                Select Menu Item
              </option>

              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - ${item.price}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block mb-2 font-medium">
              Quantity
            </label>

            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Enter quantity"
              className="w-full rounded-lg border border-border px-4 py-3 bg-background"
              required
            />
          </div>

          {/* Discount Price */}
          <div>
            <label className="block mb-2 font-medium">
              Discounted Price
            </label>

            <input
              type="number"
              step="0.01"
              name="discounted_price"
              value={isFree ? "0" : formData.discounted_price}
              onChange={handleChange}
              placeholder="0.00"
              disabled={isFree}
              className="w-full rounded-lg border border-border px-4 py-3 bg-background disabled:bg-gray-100 disabled:text-gray-500"
            />

            <div className="flex items-center gap-3 mt-3">
              <input
                type="checkbox"
                id="freeItem"
                checked={isFree}
                onChange={(e) => {
                  const checked = e.target.checked;

                  setIsFree(checked);

                  setFormData((prev) => ({
                    ...prev,
                    discounted_price: checked ? "0" : "",
                  }));
                }}
                className="w-4 h-4"
              />

              <label
                htmlFor="freeItem"
                className="font-medium"
              >
                🎁 Give this item away for FREE
              </label>
            </div>
          </div>

          {/* Pickup Start */}
          <div>
            <label className="block mb-2 font-medium">
              Pickup Start
            </label>

            <input
              type="datetime-local"
              name="pickup_window_start"
              value={formData.pickup_window_start}
              onChange={handleChange}
              className="w-full rounded-lg border border-border px-4 py-3 bg-background"
              required
            />
          </div>

          {/* Pickup End */}
          <div>
            <label className="block mb-2 font-medium">
              Pickup End
            </label>

            <input
              type="datetime-local"
              name="pickup_window_end"
              value={formData.pickup_window_end}
              onChange={handleChange}
              className="w-full rounded-lg border border-border px-4 py-3 bg-background"
              required
            />
          </div>

        </div>

        <div className="flex justify-end mt-8">
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition"
          >
            Create Listing
          </button>
        </div>
      </form>
    </div>
  );
}