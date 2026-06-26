"use client";

import { useEffect, useState } from "react";

export default function SurplusPublicPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  //const [monthlyCount] = useState(0);

  useEffect(() => {
    fetchSurplusItems();
  }, []);

  async function fetchSurplusItems() {
    try {
      setLoading(true);
      const response = await fetch("/api/surplus");
      const data = await response.json();
       const availableItems = (data || []).filter(
  (item) =>
    item.quantity > 0 &&
    !item.is_claimed &&
    new Date(item.pickup_window_end) > new Date()
);

setItems(availableItems);
setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  async function claimFood(itemId) {
    try {
      const response = await fetch(`/api/surplus/${itemId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: 1,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      alert("Food claimed successfully!");

      fetchSurplusItems();
    } catch (error) {
      alert(error.message);
    }
  }
  const filteredItems = items.filter((item) =>
  item.menu_items?.name
    ?.toLowerCase()
    .includes(search.toLowerCase())
);
  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}

        <div className="text-center mb-10">

          <h1 className="text-5xl font-bold">
            Community Food Sharing Board
          </h1>

          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
            Reducing food waste one meal at a time.
            View available surplus food portions prepared fresh by
            our kitchen team.
          </p>

        </div>

        

        {/* Search */}

        <div className="bg-white rounded-2xl border p-6 mb-8">

          <div>

  <input
  type="text"
  placeholder="Search available food..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="border rounded-xl px-4 py-3"
/>

</div>

        </div>

        {/* Main */}

        <div className="grid lg:grid-cols-3 gap-8">

          {/* Food Cards */}

          <div className="lg:col-span-2">

           <h2 className="text-2xl font-bold mb-6">
  🍽️ Available Portions Today
</h2>
            

            <div className="grid md:grid-cols-2 gap-6">

             {filteredItems.length === 0 ? (

<div className="col-span-2 bg-white border rounded-2xl p-12 text-center">

<div className="text-6xl mb-4">
🍽️
</div>

<h3 className="text-2xl font-bold">
No surplus food available
</h3>

<p className="text-gray-500 mt-2">
Please check back later for newly available meals.
</p>

</div>

) : (

filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border p-6 shadow-sm hover:shadow-lg transition"
                >
                  <div className="flex justify-between items-start">

  <h3 className="font-bold text-lg">
    {item.menu_items?.name}
  </h3>

  <div className="flex gap-2">

    {item.discounted_price === 0 && (
      <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">
        FREE
      </span>
    )}

    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">
      {item.quantity} Portions Left
    </span>

  </div>

</div>

                  <div className="mt-5 space-y-3 text-sm">

                   <div className="flex items-center gap-2 text-gray-600">
  <span className="text-lg">📅</span>

  <div>
    <p className="text-xs text-gray-500 uppercase">
      Pickup Ends
    </p>

    <p className="font-medium">
      {new Date(item.pickup_window_end).toLocaleString()}
    </p>
  </div>
</div>

                    <div className="flex justify-between items-center">
  <span className="font-medium">Price</span>

  {item.discounted_price === 0 ? (
    <span className="text-2xl font-bold text-green-600">
      FREE 🎉
    </span>
  ) : (
    <span className="text-2xl font-bold text-orange-600">
      ${item.discounted_price}
    </span>
  )}
</div>
                    <div className="flex justify-between items-center">
  <span>Original Price</span>
  <span className="line-through text-gray-400">
    ${item.menu_items?.price}
  </span>
</div>

                  </div>

                  <button
                    onClick={() => claimFood(item.id)}
                    disabled={item.quantity <= 0}
                     className="mt-6 w-full rounded-xl bg-orange-600 py-3 font-semibold text-white transition-all duration-200 hover:bg-orange-700 hover:scale-[1.02] disabled:opacity-50"
                  >
                    {item.quantity <= 0
                      ? "Sold Out"
                      : "Claim Food"}
                  </button>

                </div>
              ))
            )}

            </div>

          </div>

          {/* Claim Guide */}

          <div className="bg-white rounded-2xl border p-6 h-fit">

            <h2 className="text-xl font-bold mb-6">
              How to Claim Food
            </h2>

            <div className="space-y-5">

<div className="flex gap-4">
<div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
1
</div>
<p>Browse available meals.</p>
</div>

<div className="flex gap-4">
<div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
2
</div>
<p>Visit before the pickup time ends.</p>
</div>

<div className="flex gap-4">
<div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
3
</div>
<p>Show the listing to our staff.</p>
</div>

<div className="flex gap-4">
<div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">
4
</div>
<p>Enjoy your meal while reducing food waste.</p>
</div>

</div>

          </div>

        </div>

      </div>
    </div>
  );
}