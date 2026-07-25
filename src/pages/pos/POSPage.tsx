import { useEffect, useRef, useState } from "react";
import { getProductByBarcode, checkoutSale } from "../../api/posApi";
import { getProducts } from "../../api/productApi";
import { useCartStore } from "../../store/cartStore";
import { useToast } from "../../store/toastStore";
import { useBeep } from "../../hooks/useBeep";
import { printReceipt } from "../../utils/printReceipt";
import { getCustomers, createCustomer } from "../../api/customerApi";

interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

export default function POSPage() {
  const [barcode, setBarcode] = useState("");
  const [search, setSearch] = useState("");
  const [cash, setCash] = useState(0);

  const [paymentMode, setPaymentMode] = useState<"cash" | "credit">("cash");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [paidAmount, setPaidAmount] = useState(0);

  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");


  const barcodeRef = useRef<HTMLInputElement | null>(null);

  const {
    items,
    addItem,
    removeItem,
    increaseQty,
    decreaseQty,
    clearCart,
    getTotal,
  } = useCartStore();

  const { showToast } = useToast();
  const { beep } = useBeep();

  const total = getTotal();
  const change = cash - total;
  const balance = total - paidAmount;

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data || []);
    } catch {
      showToast("Failed to load customers", "error");
    }
  };

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }

      const data = await getProducts();

      const filtered = data.filter(
        (p: Product) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode.includes(search)
      );

      setResults(filtered);
      setShowResults(true);
    }, 300);

    return () => clearTimeout(delay);
  }, [search]);

  const handleScan = async () => {
    if (!barcode) return;

    try {
      const product = await getProductByBarcode(barcode);

      addItem({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        quantity: 1,
      });

      beep();
      setBarcode("");
    } catch {
      showToast("Product not found", "error");
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      showToast("Cart is empty", "error");
      return;
    }

    if (paymentMode === "cash" && cash < total) {
      showToast("Insufficient cash", "error");
      return;
    }

    if (paymentMode === "credit" && !selectedCustomerId) {
      showToast("Select customer", "error");
      return;
    }

    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.id,
          quantity: i.quantity,
        })),
        paidAmount: paymentMode === "cash" ? cash : paidAmount,
        customerId: paymentMode === "credit" ? selectedCustomerId : null,
        customerName: null,
        customerPhone: null,
      };

      const res = await checkoutSale(payload);

      const selectedCustomer = customers.find(
        (c) => c.id === selectedCustomerId
      );

      showToast("Checkout successful", "success");

      printReceipt({
        invoiceNumber: res?.invoiceNumber,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        total,
        paid: paymentMode === "cash" ? cash : paidAmount,
        change: paymentMode === "cash" ? change : 0,
        balance: paymentMode === "credit" ? balance : 0,
        paymentMode,
        customerName: selectedCustomer?.name,
        customerPhone: selectedCustomer?.phone,
      });

      clearCart();
      setCash(0);
      setPaidAmount(0);
      setSelectedCustomerId("");
      setPaymentMode("cash");
    } catch {
      showToast("Checkout failed", "error");
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName || !newCustomerPhone) {
      showToast("Enter customer details", "error");
      return;
    }

    try {
      const data = await createCustomer({
        name: newCustomerName,
        phone: newCustomerPhone,
      });

      setCustomers((prev) => [...prev, data]);
      setSelectedCustomerId(data.id);

      setShowCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerPhone("");

      showToast("Customer added", "success");
    } catch {
      showToast("Failed to add customer", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 font-sans text-gray-900">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1400px] mx-auto">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 flex flex-col gap-4">

          {/* TOP CONTROLS: SCAN & SEARCH */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SCAN */}
            <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-4">
              <label className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-2 block">
                Scan Barcode
              </label>
              <div className="flex items-center bg-white border border-gray-300 rounded-sm focus-within:border-[#0B6E4F] focus-within:ring-1 focus-within:ring-[#0B6E4F] transition-colors">
                <div className="pl-3 pr-2 text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                    <path d="M3 5v14M7 5v14M10 5v14M14 5v10M17 5v14M21 5v14" />
                  </svg>
                </div>
                <input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  placeholder="Ready to scan..."
                  className="w-full py-2.5 pr-3 text-sm font-mono outline-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* SEARCH */}
            <div className="bg-white border border-gray-300 rounded-sm shadow-sm p-4 relative">
              <label className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-2 block">
                Find Product
              </label>
              <div className="flex items-center bg-white border border-gray-300 rounded-sm focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500 transition-colors">
                <div className="pl-3 pr-2 text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="square" />
                  </svg>
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full py-2.5 pr-3 text-sm outline-none placeholder:text-gray-400"
                  placeholder="Search name or barcode..."
                />
              </div>

              {/* SEARCH RESULTS DROPDOWN */}
              {showResults && results.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-300 shadow-md max-h-60 overflow-y-auto rounded-sm z-20">
                  {results.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        addItem({
                          id: p.id,
                          name: p.name,
                          barcode: p.barcode,
                          price: p.price,
                          quantity: 1,
                        });
                        beep();
                        setSearch("");
                        setShowResults(false);
                      }}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{p.barcode}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#0B6E4F]">
                        Rs {p.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CART */}
          <div className="bg-white border border-gray-300 rounded-sm shadow-sm flex-1 flex flex-col min-h-[400px]">
            <div className="px-4 py-3 border-b border-gray-300 flex items-center justify-between bg-gray-50">
              <h2 className="text-xs font-bold tracking-wider text-gray-600 uppercase">
                Current Sale
              </h2>
              <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-sm">
                {items.length} {items.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm font-medium uppercase tracking-widest">
                  Cart is empty
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                    <tr>
                      <th className="pb-2 font-bold text-left">Item</th>
                      <th className="pb-2 font-bold text-center w-32">Qty</th>
                      <th className="pb-2 font-bold text-right w-24">Total</th>
                      <th className="pb-2 font-bold text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b border-gray-100 last:border-0 group hover:bg-gray-50">
                        <td className="py-3 pr-2">
                          <p className="font-semibold text-gray-800">{i.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Rs {i.price.toFixed(2)} each</p>
                        </td>
                        <td className="py-3 px-2 align-middle">
                          <div className="flex items-center justify-center gap-1 border border-gray-300 rounded-sm bg-white overflow-hidden w-fit mx-auto">
                            <button
                              onClick={() => decreaseQty(i.id)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-sm">
                              {i.quantity}
                            </span>
                            <button
                              onClick={() => increaseQty(i.id)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 pl-2 text-right align-middle">
                          <span className="font-mono font-bold text-gray-900">
                            Rs {(i.price * i.quantity).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 text-center align-middle">
                          <button
                            onClick={() => removeItem(i.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Remove item"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                              <path d="M3 6h18M8 6V4h8v2m-2 14H10a2 2 0 01-2-2V8h8v10a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* REGISTER TOTAL DISPLAY */}
          <div className="bg-gray-900 border border-gray-800 rounded-sm p-6 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#4ADE9A]"></div>
            <p className="text-xs font-bold tracking-widest uppercase text-gray-400">
              Total Due
            </p>
            <p className="mt-2 font-mono text-4xl md:text-5xl font-bold tabular-nums text-[#4ADE9A] tracking-tight">
              Rs {total.toFixed(2)}
            </p>
          </div>

          {/* PAYMENT PANEL */}
          <div className="bg-white border border-gray-300 rounded-sm shadow-sm flex flex-col flex-1">
            <div className="px-4 py-3 border-b border-gray-300 bg-gray-50">
              <h2 className="text-xs font-bold tracking-wider text-gray-600 uppercase">
                Payment Details
              </h2>
            </div>

            <div className="p-4 space-y-5 flex-1">
              {/* TOGGLE */}
              <div className="flex border border-gray-300 rounded-sm overflow-hidden bg-gray-50">
                <button
                  onClick={() => setPaymentMode("cash")}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${paymentMode === "cash"
                      ? "bg-[#0B6E4F] text-white"
                      : "text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Cash
                </button>
                <div className="w-px bg-gray-300"></div>
                <button
                  onClick={() => {
                    setPaymentMode("credit");
                    loadCustomers();
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${paymentMode === "credit"
                      ? "bg-gray-800 text-white"
                      : "text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Credit
                </button>
              </div>

              {/* CASH INPUTS */}
              {paymentMode === "cash" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold tracking-wider text-gray-600 uppercase block mb-1.5">
                      Amount Received
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm font-bold">Rs</span>
                      <input
                        type="number"
                        value={cash || ""}
                        onChange={(e) => setCash(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-sm font-mono text-lg font-bold outline-none focus:border-[#0B6E4F] focus:ring-1 focus:ring-[#0B6E4F] transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-sm">
                    <span className="text-gray-600 uppercase tracking-widest text-xs font-bold">Change Due</span>
                    <span
                      className={`font-mono font-bold text-xl ${change >= 0 ? "text-[#0B6E4F]" : "text-red-600"
                        }`}
                    >
                      Rs {change.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* CREDIT INPUTS */}
              {paymentMode === "credit" && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <label className="text-xs font-bold tracking-wider text-gray-600 uppercase block">
                        Select Customer
                      </label>
                      <button
                        onClick={() => setShowCustomerModal(true)}
                        className="text-gray-600 text-xs font-bold uppercase tracking-wider hover:text-gray-900 flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                        New
                      </button>
                    </div>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-sm text-sm outline-none focus:border-gray-800 focus:ring-1 focus:ring-gray-800 transition-colors cursor-pointer"
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold tracking-wider text-gray-600 uppercase block mb-1.5">
                      Initial Payment
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm font-bold">Rs</span>
                      <input
                        type="number"
                        value={paidAmount || ""}
                        onChange={(e) => setPaidAmount(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-sm font-mono text-lg font-bold outline-none focus:border-gray-800 focus:ring-1 focus:ring-gray-800 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-sm">
                    <span className="text-gray-600 uppercase tracking-widest text-xs font-bold">Remaining Balance</span>
                    <span
                      className={`font-mono font-bold text-xl ${balance > 0 ? "text-red-600" : "text-gray-900"
                        }`}
                    >
                      Rs {balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* CHECKOUT BUTTON */}
            <div className="p-4 border-t border-gray-300 bg-gray-50">
              <button
                onClick={handleCheckout}
                disabled={items.length === 0}
                className={`w-full py-4 text-sm font-bold uppercase tracking-widest rounded-sm transition-colors ${items.length === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-[#0B6E4F] text-white hover:bg-[#08523b] shadow-sm"
                  }`}
              >
                Complete Sale
              </button>
            </div>
          </div>
        </div>

        {/* CUSTOMER MODAL */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-300 rounded-sm w-full max-w-sm shadow-xl">
              <div className="px-5 py-4 border-b border-gray-300 bg-gray-50">
                <h2 className="text-sm font-bold tracking-wider text-gray-800 uppercase">Create Customer</h2>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold tracking-wider text-gray-600 uppercase block mb-1.5">Full Name</label>
                  <input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-sm text-sm outline-none focus:border-gray-800 focus:ring-1 focus:ring-gray-800 transition-colors"
                    placeholder="Enter name"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold tracking-wider text-gray-600 uppercase block mb-1.5">Phone Number</label>
                  <input
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-sm text-sm outline-none focus:border-gray-800 focus:ring-1 focus:ring-gray-800 transition-colors"
                    placeholder="Enter phone"
                  />
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-300 bg-gray-50 flex gap-3">
                <button
                  onClick={() => {
                    setShowCustomerModal(false);
                    setNewCustomerName("");
                    setNewCustomerPhone("");
                  }}
                  className="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 py-2.5 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomer}
                  className="flex-1 bg-gray-900 hover:bg-black text-white py-2.5 rounded-sm transition-colors text-xs font-bold uppercase tracking-wider"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}