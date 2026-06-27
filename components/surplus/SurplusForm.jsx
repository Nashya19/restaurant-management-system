"use client";

import { useState, useEffect } from "react";
import CustomDatePicker from "../schedule/CustomDatePicker";

export default function SurplusForm() {
  const [menuItems, setMenuItems] = useState([]);
  const [isFree, setIsFree] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState(null);

  const [formData, setFormData] = useState({
    menu_item_id: "",
    quantity: "",
    discounted_price: "",
  });

  // Date and Time picker states
  const [startDate, setStartDate] = useState("");
  const [startHour, setStartHour] = useState("12");
  const [startMin, setStartMin] = useState("00");

  const [endDate, setEndDate] = useState("");
  const [endHour, setEndHour] = useState("14");
  const [endMin, setEndMin] = useState("00");

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
    // Clear field-specific error as user typing/changing
    if (errors[e.target.name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[e.target.name];
        return copy;
      });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};

    if (!formData.menu_item_id) {
      newErrors.menu_item_id = "Please select a menu item.";
    }

    if (!formData.quantity) {
      newErrors.quantity = "Quantity is required.";
    } else if (isNaN(Number(formData.quantity)) || !Number.isInteger(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
      newErrors.quantity = "Quantity must be a positive whole number (e.g., 22 or 23).";
    }

    const selectedItem = menuItems.find(item => item.id === formData.menu_item_id);
    const originalPrice = selectedItem ? Number(selectedItem.price) : null;

    if (!isFree) {
      if (formData.discounted_price === "" || formData.discounted_price === undefined) {
        newErrors.discounted_price = "Discounted price is required.";
      } else if (isNaN(Number(formData.discounted_price)) || Number(formData.discounted_price) < 0) {
        newErrors.discounted_price = "Price must be a valid non-negative number.";
      } else if (originalPrice !== null && Number(formData.discounted_price) > originalPrice) {
        newErrors.discounted_price = `Price cannot exceed the original price (₹${originalPrice.toFixed(2)}).`;
      }
    }

    if (!startDate) {
      newErrors.startDate = "Please select a start date.";
    }
    if (!endDate) {
      newErrors.endDate = "Please select an end date.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSuccessMsg(null);

    const startHourStr = startHour.padStart(2, '0');
    const startMinStr = startMin.padStart(2, '0');
    const endHourStr = endHour.padStart(2, '0');
    const endMinStr = endMin.padStart(2, '0');

    const pickup_window_start = `${startDate}T${startHourStr}:${startMinStr}:00`;
    const pickup_window_end = `${endDate}T${endHourStr}:${endMinStr}:00`;

    try {
      const response = await fetch("/api/surplus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          pickup_window_start,
          pickup_window_end,
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
      
      setSuccessMsg("Surplus food listing created successfully!");

      setFormData({
        menu_item_id: "",
        quantity: "",
        discounted_price: "",
      });
      setStartDate("");
      setEndDate("");
      setStartHour("12");
      setStartMin("00");
      setEndHour("14");
      setEndMin("00");
      setIsFree(false);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: error.message || "Failed to create listing" });
    }
  }

  return (
    <div className="card border border-border rounded-2xl p-6 bg-surface shadow-lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          Create Surplus Listing
        </h2>

        <p className="text-xs text-[var(--text-secondary)] mt-1 font-semibold">
          Publish surplus food items for community distribution.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {errors.submit && (
          <div className="mb-5 flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive text-xs p-3.5 rounded-xl animate-fade-in">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{errors.submit}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 flex items-start gap-2 bg-success-bg border border-success-border text-success text-xs p-3.5 rounded-xl animate-fade-in">
            <span className="shrink-0 mt-0.5">✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">

          {/* Menu Item */}
          <div>
            <label className="block mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Menu Item
            </label>

            <select
              name="menu_item_id"
              value={formData.menu_item_id}
              onChange={handleChange}
              className={`w-full rounded-xl border px-4 py-2.5 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all cursor-pointer font-semibold ${
                errors.menu_item_id ? "border-destructive focus:border-destructive" : "border-border"
              }`}
            >
              <option value="">
                Select Menu Item
              </option>

              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - ₹{item.price}
                </option>
              ))}
            </select>

            {errors.menu_item_id && (
              <p className="text-[10px] text-destructive font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                <span>⚠️</span> {errors.menu_item_id}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Quantity
            </label>

            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Enter quantity"
              className={`w-full rounded-xl border px-4 py-2.5 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all ${
                errors.quantity ? "border-destructive focus:border-destructive" : "border-border"
              }`}
            />

            {errors.quantity && (
              <p className="text-[10px] text-destructive font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                <span>⚠️</span> {errors.quantity}
              </p>
            )}
          </div>

          {/* Discount Price */}
          <div className="md:col-span-2">
            <label className="block mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
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
              className={`w-full rounded-xl border px-4 py-2.5 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all disabled:opacity-50 disabled:bg-[var(--surface-raised)] ${
                errors.discounted_price ? "border-destructive focus:border-destructive" : "border-border"
              }`}
            />

            {errors.discounted_price && (
              <p className="text-[10px] text-destructive font-bold mt-1.5 flex items-center gap-1 animate-fade-in">
                <span>⚠️</span> {errors.discounted_price}
              </p>
            )}

            <div className="flex items-center gap-2.5 mt-3 select-none">
              <label className="relative flex items-center gap-2.5 cursor-pointer group">
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
                    if (errors.discounted_price) {
                      setErrors(prev => {
                        const copy = { ...prev };
                        delete copy.discounted_price;
                        return copy;
                      });
                    }
                  }}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  isFree 
                    ? 'bg-[var(--accent)] border-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/25' 
                    : 'border-border bg-background group-hover:border-[var(--accent)]/50'
                }`}>
                  {isFree && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                  Give this item away for FREE
                </span>
              </label>
            </div>
          </div>

          {/* Pickup Start */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Pickup Start Date
            </label>
            <CustomDatePicker
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                if (errors.startDate) setErrors(prev => ({ ...prev, startDate: null }));
              }}
              placeholder="Select start date"
            />
            
            {errors.startDate && (
              <p className="text-[10px] text-destructive font-bold mt-1 flex items-center gap-1 animate-fade-in">
                <span>⚠️</span> {errors.startDate}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Hour</label>
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-semibold"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = String(i).padStart(2, '0');
                    return <option key={h} value={h}>{h}</option>;
                  })}
                </select>
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Min</label>
                <select
                  value={startMin}
                  onChange={(e) => setStartMin(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-semibold"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pickup End */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Pickup End Date
            </label>
            <CustomDatePicker
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                if (errors.endDate) setErrors(prev => ({ ...prev, endDate: null }));
              }}
              placeholder="Select end date"
            />

            {errors.endDate && (
              <p className="text-[10px] text-destructive font-bold mt-1 flex items-center gap-1 animate-fade-in">
                <span>⚠️</span> {errors.endDate}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1">
                <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Hour</label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-semibold"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = String(i).padStart(2, '0');
                    return <option key={h} value={h}>{h}</option>;
                  })}
                </select>
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Min</label>
                <select
                  value={endMin}
                  onChange={(e) => setEndMin(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2 bg-background text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-semibold"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="btn btn-primary btn-premium px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
          >
            Create Listing
          </button>
        </div>
      </form>
    </div>
  );
}