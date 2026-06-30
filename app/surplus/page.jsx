"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAlertConfirm } from '@/lib/hooks/useAlertConfirm';
import { 
  Edit2, Trash2, CheckCircle2, Calendar, Filter, Search, 
  Plus, Heart, Info, Clock, Utensils, TrendingUp, History, 
  Loader2, X, RefreshCw, PhoneCall
} from "lucide-react";
import SurplusForm from "@/components/surplus/SurplusForm";

export default function SurplusPage() {
  const supabase = createClient();
  const [role, setRole] = useState("public");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  
  // Tabs: 'active', 'create', 'history'
  const [activeTab, setActiveTab] = useState("active");

  // Filtering & Sorting State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, price_high, price_low

  const { showAlert, showConfirm, AlertConfirmComponent } = useAlertConfirm();

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editFormData, setEditFormData] = useState({
    quantity: "",
    discounted_price: "",
    pickup_window_start: "",
    pickup_window_end: ""
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Determine current user role
  useEffect(() => {
    async function determineRole() {
      try {
        const devRole = localStorage.getItem("dev-role");
        if (devRole) {
          if (devRole === "customer") {
            setRole("public");
          } else {
            setRole(devRole);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setRole("public");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role === "admin") {
          setRole("admin");
        } else if (profile?.role === "staff") {
          setRole("staff");
        } else {
          setRole("public");
        }
      } catch (err) {
        console.error("Error determining role:", err);
        setRole("public");
      }
    }

    determineRole().then(() => fetchSurplusItems());
  }, [supabase]);

  // Fetch all items from the database
  async function fetchSurplusItems() {
    try {
      setLoading(true);
      const response = await fetch("/api/surplus");
      const data = await response.json();
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching surplus:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filter listings based on active status vs historical
  const { activeItems, historyItems } = useMemo(() => {
    const now = new Date();
    const active = [];
    const history = [];

    items.forEach((item) => {
      const isExpired = new Date(item.pickup_window_end) <= now;
      const isDone = item.is_claimed || item.quantity <= 0 || isExpired;
      
      if (isDone) {
        history.push(item);
      } else {
        active.push(item);
      }
    });

    return { activeItems: active, historyItems: history };
  }, [items]);

  // Apply filters/sorting to history items
  const filteredHistoryItems = useMemo(() => {
    let result = [...historyItems];
    const now = new Date();

    // 1. Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        item.menu_items?.name?.toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (statusFilter === "claimed") {
      result = result.filter(item => item.is_claimed || item.quantity === 0);
    } else if (statusFilter === "expired") {
      result = result.filter(item => {
        const isExpired = new Date(item.pickup_window_end) <= now;
        return isExpired && !item.is_claimed && item.quantity > 0;
      });
    }

    // 3. Date range filter
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      result = result.filter(item => new Date(item.created_at) >= start);
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      // set to end of that day
      end.setHours(23, 59, 59, 999);
      result = result.filter(item => new Date(item.created_at) <= end);
    }

    // 4. Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortBy === "price_high") {
        return b.discounted_price - a.discounted_price;
      }
      if (sortBy === "price_low") {
        return a.discounted_price - b.discounted_price;
      }
      return 0;
    });

    return result;
  }, [historyItems, search, statusFilter, startDateFilter, endDateFilter, sortBy]);

  // Claim Food (Public/Customer action)
  async function claimFood(itemId) {
    try {
      const response = await fetch(`/api/surplus/${itemId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      await showAlert("Food claimed successfully!");
      fetchSurplusItems();
    } catch (error) {
      await showAlert(error.message);
    }
  }

  // Mark Listing as Done (Admin & Staff action)
  async function markAsDone(itemId) {
    const confirmed = await showConfirm("Are you sure you want to mark this listing as completed/done?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/surplus/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_claimed: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      fetchSurplusItems();
    } catch (error) {
      await showAlert(error.message);
    }
  }

  // Delete Listing (Admin action only)
  async function deleteListing(itemId) {
    const confirmed = await showConfirm("Are you sure you want to permanently delete this listing?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/surplus/${itemId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      fetchSurplusItems();
    } catch (error) {
      await showAlert(error.message);
    }
  }

  // Open Edit Modal
  function handleOpenEdit(item) {
    // Format datetimes for input fields
    const formatDateTime = (isoStr) => {
      if (!isoStr) return "";
      const date = new Date(isoStr);
      // Adjust to local timezone format YYYY-MM-DDTHH:MM
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEditingItem(item);
    setEditFormData({
      quantity: item.quantity,
      discounted_price: item.discounted_price,
      pickup_window_start: formatDateTime(item.pickup_window_start),
      pickup_window_end: formatDateTime(item.pickup_window_end)
    });
    setEditError("");
  }

  // Handle Edit Submission
  async function handleEditSubmit(e) {
    e.preventDefault();
    setIsSavingEdit(true);
    setEditError("");

    try {
      const response = await fetch(`/api/surplus/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(editFormData.quantity),
          discounted_price: Number(editFormData.discounted_price),
          pickup_window_start: new Date(editFormData.pickup_window_start).toISOString(),
          pickup_window_end: new Date(editFormData.pickup_window_end).toISOString()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update listing");

      setEditingItem(null);
      fetchSurplusItems();
    } catch (error) {
      setEditError(error.message);
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Stats calculations
  const totalMealsShared = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.total_given_away || 0), 0);
  }, [items]);

  const activeCount = activeItems.length;

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-[var(--accent)] inline-block" />
          <p className="mt-4 text-[var(--text-secondary)] font-medium">Loading surplus board…</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // 1. PUBLIC VIEW (Community Sharing Board)
  // ==========================================
  if (role === "public") {
    const publicFilteredItems = activeItems.filter(item => 
      item.menu_items?.name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
        {AlertConfirmComponent}
        {/* Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex flex-col items-center justify-center space-y-2 mb-2">
            <img 
              src="/images/logo.png" 
              alt="Sauté Logo" 
              className="w-14 h-14 object-contain filter drop-shadow-[0_0_8px_rgba(245,158,11,0.25)]" 
            />
            <span className="text-xs font-black tracking-[0.25em] uppercase text-[var(--accent)] font-sans">Sauté</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Community Food Sharing Board
          </h1>
          <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed">
            Reducing food waste one meal at a time. Registered community partners and trusted distribution representatives can view available portions and contact us directly to coordinate pick-up.
          </p>
        </div>

        {/* Reservation Call Banner */}
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm border-accent-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0">
              <PhoneCall size={22} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Reserve for Shelters & Distribution</h3>
              <p className="text-[var(--text-secondary)] text-xs mt-0.5">
                Please call our kitchen desk to claim and hold these portions for your organization.
              </p>
            </div>
          </div>
          <div className="bg-[var(--surface-raised)] border border-border rounded-xl px-5 py-3 text-center shrink-0">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">Call to Reserve</span>
            <span className="text-md font-extrabold text-[var(--accent)] font-mono">+91 98765 43210</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="bg-surface border border-border p-5 rounded-2xl max-w-lg mx-auto shadow-sm flex items-center gap-3">
          <Search size={18} className="text-[var(--text-secondary)] shrink-0" />
          <input
            type="text"
            placeholder="Search available food by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none p-0 outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] h-8"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          )}
        </div>

        {/* List Layout Table */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-primary)]">
            <span></span> Available Surplus Items
          </h2>

          {publicFilteredItems.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-12 text-center space-y-4">
              <span className="text-5xl block">️</span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">No surplus food available</h3>
              <p className="text-[var(--text-secondary)] text-xs">Please check back later for newly listed meals.</p>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-[var(--surface-raised)]/40 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="py-4 px-6">Food Item</th>
                      <th className="py-4 px-6 text-center">Portions Available</th>
                      <th className="py-4 px-6">Original Price</th>
                      <th className="py-4 px-6 text-right">Redistribution Price</th>
                      <th className="py-4 px-6 text-right">Pickup Window Ends</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {publicFilteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-background/25 transition-colors">
                        <td className="py-4 px-6 font-bold text-[var(--text-primary)]">
                          {item.menu_items?.name}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="bg-[var(--surface-raised)] border border-border text-[var(--text-primary)] text-xs font-bold px-3 py-1 rounded-full font-mono">
                            {item.quantity} Portions
                          </span>
                        </td>
                        <td className="py-4 px-6 text-[var(--text-muted)] line-through font-mono">
                          ₹{Number(item.menu_items?.price).toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-extrabold text-sm">
                          {item.discounted_price === 0 ? (
                            <span className="text-green-600 font-bold">FREE </span>
                          ) : (
                            <span className="text-[var(--accent)]">₹{Number(item.discounted_price).toFixed(2)}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right text-[var(--text-secondary)]">
                          {new Date(item.pickup_window_end).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. ADMIN & STAFF DASHBOARD VIEW
  // ==========================================
  return (
    <div className="space-y-8 animate-fade-in w-full max-w-7xl mx-auto">
      {AlertConfirmComponent}
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Surplus Meal Management
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Redistribute leftover inventory, track food sharing logistics, and coordinate community meals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={fetchSurplusItems}
            className="btn btn-ghost rounded-xl text-xs font-semibold flex items-center gap-2 h-10 w-fit cursor-pointer self-start"
          >
            <RefreshCw size={14} /> Refresh Board
          </button>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/surplus`;
              await navigator.clipboard.writeText(url);
              await showAlert('Public surplus board link copied to clipboard!');
            }}
            className="btn border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black rounded-xl text-xs font-semibold flex items-center gap-2 h-10 w-fit cursor-pointer self-start transition-all"
            title="Copy Public Link"
          >
             Share Public Link
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="stat-card flex items-center justify-between">
          <div>
            <span className="stat-card-label">Active Listings</span>
            <h2 className="stat-card-value text-[var(--accent)] mt-1">{activeCount}</h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
            <Utensils size={20} />
          </div>
        </div>

        <div className="stat-card flex items-center justify-between">
          <div>
            <span className="stat-card-label">Meals Shared</span>
            <h2 className="stat-card-value text-success mt-1">{totalMealsShared}</h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-success-bg border border-success-border flex items-center justify-center text-success shrink-0">
            <Heart size={20} />
          </div>
        </div>

        <div className="stat-card flex items-center justify-between">
          <div>
            <span className="stat-card-label">Community Impact</span>
            <h2 className="stat-card-value mt-1">{totalMealsShared} Shared</h2>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-raised)] border border-border flex items-center justify-center text-[var(--text-secondary)] shrink-0">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      {/* Tabs Controller */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "active"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Utensils size={14} /> Active Listings
        </button>

        {role === "admin" && (
          <button
            onClick={() => setActiveTab("create")}
            className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "create"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Plus size={14} /> Create Listing
          </button>
        )}

        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "history"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <History size={14} /> Distribution History
        </button>
      </div>

      {/* Tab Contents */}
      <div className="space-y-6">
        {/* ACTIVE LISTINGS TAB */}
        {activeTab === "active" && (
          <div className="card bg-surface border border-border rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Clock size={16} className="text-[var(--accent)]" /> Current Active Listings
            </h2>

            {activeItems.length === 0 ? (
              <p className="text-center text-xs text-[var(--text-muted)] py-10 font-medium italic">
                No active surplus items at the moment.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="pb-3 px-4">Food Item</th>
                      <th className="pb-3 px-4">Portions Left</th>
                      <th className="pb-3 px-4">Discount Price</th>
                      <th className="pb-3 px-4">Pickup Window</th>
                      <th className="pb-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {activeItems.map((item) => (
                      <tr key={item.id} className="hover:bg-background/25 transition-colors">
                        <td className="py-4 px-4 font-bold text-[var(--text-primary)]">
                          {item.menu_items?.name}
                        </td>
                        <td className="py-4 px-4 font-mono font-medium text-[var(--text-primary)]">
                          {item.quantity}
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-[var(--accent)]">
                          ₹{Number(item.discounted_price).toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-[var(--text-secondary)]">
                          <div>
                            <span className="font-semibold text-[var(--text-primary)]">Ends: </span>
                            {new Date(item.pickup_window_end).toLocaleString()}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => markAsDone(item.id)}
                              title="Mark as Claimed/Completed"
                              className="btn border border-success-border bg-success-bg text-success hover:bg-success hover:text-black text-[10px] px-2.5 py-1.5 h-8 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={12} /> Mark Done
                            </button>

                            {role === "admin" && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  title="Edit Listing"
                                  className="btn bg-background border border-border hover:bg-surface-raised text-[10px] px-2.5 py-1.5 h-8 rounded-lg font-bold flex items-center gap-1 cursor-pointer text-[var(--text-primary)]"
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => deleteListing(item.id)}
                                  title="Delete Listing"
                                  className="btn border border-destructive-border bg-destructive-bg text-destructive hover:bg-destructive hover:text-white text-[10px] px-2.5 py-1.5 h-8 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 size={12} /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CREATE LISTING TAB (ADMIN ONLY) */}
        {activeTab === "create" && role === "admin" && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SurplusForm />
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6 h-fit space-y-4">
              <h3 className="text-md font-bold text-[var(--text-primary)] border-b border-border pb-3 flex items-center gap-2">
                <Info size={16} className="text-[var(--accent)]" /> Publishing Tips
              </h3>
              <ul className="space-y-3.5 text-xs text-[var(--text-secondary)] font-medium">
                <li>Choose a meal that has excess portions pre-cooked or prepared.</li>
                <li>Set a significant discount or choose FREE to encourage community redistribution.</li>
                <li>Set the pickup window start to *now* and end to *kitchen closing hour* to ensure quality freshness.</li>
              </ul>
            </div>
          </div>
        )}

        {/* DISTRIBUTION HISTORY TAB */}
        {activeTab === "history" && (
          <div className="card bg-surface border border-border rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <History size={16} className="text-[var(--accent)]" /> Distribution Log & History
            </h2>

            {/* Filter Bar */}
            <div className="bg-background border border-border p-5 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Search */}
              <div className="flex items-center gap-2 bg-[var(--surface-raised)] border border-border rounded-lg px-3 h-10">
                <Search size={14} className="text-[var(--text-secondary)]" />
                <input
                  type="text"
                  placeholder="Search food item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent border-none p-0 outline-none text-xs text-[var(--text-primary)]"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[var(--surface-raised)] border border-border rounded-lg text-xs h-10 px-3 cursor-pointer outline-none"
              >
                <option value="all">All Historical</option>
                <option value="claimed">Fully Claimed</option>
                <option value="expired">Expired</option>
              </select>

              {/* Start Date */}
              <div className="flex flex-col justify-center">
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full bg-[var(--surface-raised)] border border-border rounded-lg text-xs h-10 px-3 cursor-pointer outline-none font-sans"
                  placeholder="Start Date"
                />
              </div>

              {/* End Date */}
              <div className="flex flex-col justify-center">
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full bg-[var(--surface-raised)] border border-border rounded-lg text-xs h-10 px-3 cursor-pointer outline-none font-sans"
                  placeholder="End Date"
                />
              </div>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-[var(--surface-raised)] border border-border rounded-lg text-xs h-10 px-3 cursor-pointer outline-none"
              >
                <option value="newest">Created: Newest First</option>
                <option value="oldest">Created: Oldest First</option>
                <option value="price_high">Price: High to Low</option>
                <option value="price_low">Price: Low to High</option>
              </select>
            </div>

            {filteredHistoryItems.length === 0 ? (
              <p className="text-center text-xs text-[var(--text-muted)] py-10 font-medium italic">
                No matching historical surplus records.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="pb-3 px-4">Food Item</th>
                      <th className="pb-3 px-4">Given Away</th>
                      <th className="pb-3 px-4">Final Quantity</th>
                      <th className="pb-3 px-4">Discount Price</th>
                      <th className="pb-3 px-4">Pickup Expired</th>
                      <th className="pb-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {filteredHistoryItems.map((item) => {
                      const now = new Date();
                      const isExpired = new Date(item.pickup_window_end) <= now;
                      const status = (item.is_claimed || item.quantity === 0) ? "CLAIMED" : (isExpired ? "EXPIRED" : "DONE");

                      return (
                        <tr key={item.id} className="hover:bg-background/25 transition-colors">
                          <td className="py-4 px-4 font-semibold text-[var(--text-primary)]">
                            {item.menu_items?.name}
                          </td>
                          <td className="py-4 px-4 font-mono">
                            {item.total_given_away || 0} Portions
                          </td>
                          <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">
                            {item.quantity}
                          </td>
                          <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">
                            ₹{Number(item.discounted_price).toFixed(2)}
                          </td>
                          <td className="py-4 px-4 font-mono text-[var(--text-secondary)]">
                            {new Date(item.pickup_window_end).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4">
                            {status === "CLAIMED" ? (
                              <span className="px-2 py-0.5 rounded-full bg-success-bg border border-success-border text-success text-[10px] font-bold">
                                CLAIMED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-destructive-bg border border-destructive-border text-destructive text-[10px] font-bold">
                                EXPIRED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==========================================
          3. EDIT MODAL (ADMIN ONLY)
          ========================================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-lg bg-surface border border-border rounded-3xl p-6 shadow-2xl relative space-y-6 animate-fade-in">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Edit Surplus Listing</h3>
                <p className="text-[var(--text-secondary)] text-xs font-semibold mt-0.5">{editingItem.menu_items?.name}</p>
              </div>
              <button 
                onClick={() => setEditingItem(null)} 
                className="p-1 rounded-lg border border-border bg-background hover:bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {editError && (
                <div className="flex items-start gap-2 bg-destructive-bg border border-destructive-border text-destructive p-3 rounded-xl">
                  <span className="shrink-0 mt-0.5">️</span>
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">Quantity</label>
                  <input
                    type="number"
                    required
                    value={editFormData.quantity}
                    onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                    className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl px-3 h-10 outline-none text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">Discount Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editFormData.discounted_price}
                    onChange={(e) => setEditFormData({ ...editFormData, discounted_price: e.target.value })}
                    className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl px-3 h-10 outline-none text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">Pickup Window Start</label>
                <input
                  type="datetime-local"
                  required
                  value={editFormData.pickup_window_start}
                  onChange={(e) => setEditFormData({ ...editFormData, pickup_window_start: e.target.value })}
                  className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl px-3 h-10 outline-none text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold uppercase tracking-wider text-[var(--text-secondary)]">Pickup Window End</label>
                <input
                  type="datetime-local"
                  required
                  value={editFormData.pickup_window_end}
                  onChange={(e) => setEditFormData({ ...editFormData, pickup_window_end: e.target.value })}
                  className="w-full bg-background border border-border focus:border-[var(--accent)] rounded-xl px-3 h-10 outline-none text-sm font-semibold"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="btn btn-ghost rounded-xl px-4 py-2 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn btn-primary btn-premium rounded-xl px-5 py-2 font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[var(--accent)]/15"
                >
                  {isSavingEdit ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}