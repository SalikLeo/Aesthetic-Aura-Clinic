import React, { useState, useEffect } from 'react';
import { Plus, Package, Trash2, ShoppingBag, Search, Edit2, Check, X, BarChart2, Filter, Eye, EyeOff } from 'lucide-react';
import Modal from '../common/Modal';
import db from '../../database/db';
import PasswordModal from '../common/PasswordModal';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [formData, setFormData] = useState({ name: '', price: '', stock: '' });
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [filterStatus, setFilterStatus] = useState('all');
    const [statsPeriod, setStatsPeriod] = useState('Monthly');
    const [showStats, setShowStats] = useState(false);
    const [productStats, setProductStats] = useState({ total: 0, lowStock: 0, topSold: '', periodSales: 0, totalRevenue: 0, totalDiscount: 0 });
    const [editingProduct, setEditingProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
    const [salesStatsPeriod, setSalesStatsPeriod] = useState('Daily');

    const [salesSearch, setSalesSearch] = useState('');
    const [salesSortBy, setSalesSortBy] = useState('revenue-desc');
    const [salesData, setSalesData] = useState([]);
    const [salesStartDate, setSalesStartDate] = useState('');
    const [salesEndDate, setSalesEndDate] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Security state
    const [secureAction, setSecureAction] = useState({ isOpen: false, onVerified: null, actionName: '' });

    const requestSecureAction = (action, name) => {
        setSecureAction({ isOpen: true, onVerified: action, actionName: name });
    };

    const loadProducts = async () => {
        let query = "SELECT p.*, (SELECT COALESCE(SUM(quantity), 0) FROM invoice_products WHERE product_id = p.id) as sold_count FROM products p";
        const params = [];
        if (search) {
            query += " WHERE name LIKE ?";
            params.push(`%${search}%`);
        } else {
            query += " WHERE 1=1";
        }

        if (filterStatus === 'low') {
            query += " AND stock <= 5";
        } else if (filterStatus === 'out') {
            query += " AND stock = 0";
        } else if (filterStatus === 'in-stock') {
            query += " AND stock > 5";
        }

        if (sortBy === 'latest') query += " ORDER BY p.id DESC";
        else if (sortBy === 'price-asc') query += " ORDER BY price ASC";
        else if (sortBy === 'price-desc') query += " ORDER BY price DESC";
        else if (sortBy === 'stock-low') query += " ORDER BY stock ASC";
        else if (sortBy === 'alpha') query += " ORDER BY name ASC";
        else if (sortBy === 'revenue-desc') query += " ORDER BY ((SELECT COALESCE(SUM(quantity), 0) FROM invoice_products WHERE product_id = p.id) * price) DESC";
        else if (sortBy === 'revenue-asc') query += " ORDER BY ((SELECT COALESCE(SUM(quantity), 0) FROM invoice_products WHERE product_id = p.id) * price) ASC";

        const data = await db.all(query, params);
        setProducts(data || []);
    };

    const loadProductStats = async () => {
        try {
            let dateFilter = "";
            if (statsPeriod === 'Daily') dateFilter = "date(i.date) = date('now', 'localtime')";
            else if (statsPeriod === 'Weekly') dateFilter = "date(i.date) >= date('now', 'localtime', '-7 days')";
            else if (statsPeriod === 'Monthly') dateFilter = "date(i.date) >= date('now', 'localtime', 'start of month')";
            else if (statsPeriod === 'Annual') dateFilter = "date(i.date) >= date('now', 'localtime', 'start of year')";

            const totalRes = await db.get("SELECT COUNT(*) as count FROM products");
            const lowRes = await db.get("SELECT COUNT(*) as count FROM products WHERE stock <= 5");

            const topSoldRes = await db.get(`
                SELECT p.name
                FROM invoice_products ip 
                JOIN invoices i ON ip.invoice_id = i.id 
                JOIN products p ON ip.product_id = p.id
                ${dateFilter ? 'WHERE ' + dateFilter : ''}
                GROUP BY p.id
                ORDER BY SUM(ip.quantity) DESC
                LIMIT 1
            `);

            const salesRes = await db.get(`
                SELECT SUM(ip.quantity) as total_items, SUM(ip.quantity * ip.price) as total_revenue
                FROM invoice_products ip 
                JOIN invoices i ON ip.invoice_id = i.id 
                ${dateFilter ? 'WHERE ' + dateFilter : ''}
            `);

            const discRes = await db.get(`
                SELECT SUM(ip.discount) as total 
                FROM invoice_products ip 
                JOIN invoices i ON ip.invoice_id = i.id 
                ${dateFilter ? 'WHERE ' + dateFilter : ''}
            `);

            setProductStats({
                total: totalRes?.count || 0,
                lowStock: lowRes?.count || 0,
                topSold: topSoldRes?.name || 'N/A',
                periodSales: salesRes?.total_items || 0,
                totalRevenue: salesRes?.total_revenue || 0,
                totalDiscount: discRes?.total || 0
            });
        } catch (err) { console.error(err); }
    };

    const loadSalesData = async () => {
        try {
            const params = [];
            let conditions = [];

            if (salesStatsPeriod === 'Daily') conditions.push("date(i.date) = date('now', 'localtime')");
            else if (salesStatsPeriod === 'Weekly') conditions.push("date(i.date) >= date('now', 'localtime', '-7 days')");
            else if (salesStatsPeriod === 'Monthly') conditions.push("date(i.date) >= date('now', 'localtime', 'start of month')");
            else if (salesStatsPeriod === 'Annual') conditions.push("date(i.date) >= date('now', 'localtime', 'start of year')");
            else if (salesStatsPeriod === 'Custom' && salesStartDate && salesEndDate) {
                conditions.push("date(i.date) >= ? AND date(i.date) <= ?");
                params.push(salesStartDate, salesEndDate);
            }

            if (salesSearch) {
                conditions.push("p.name LIKE ?");
                params.push(`%${salesSearch}%`);
            }

            const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

            const validSorts = {
                'revenue-desc': 'total_revenue DESC',
                'revenue-asc': 'total_revenue ASC',
                'quantity-desc': 'quantity_sold DESC',
                'quantity-asc': 'quantity_sold ASC',
                'price-desc': 'price DESC',
                'price-asc': 'price ASC',
                'name-asc': 'name ASC',
                'name-desc': 'name DESC'
            };
            const orderBy = validSorts[salesSortBy] || 'total_revenue DESC';

            const query = `
                SELECT 
                    p.name, 
                    p.price,
                    SUM(ip.quantity) as quantity_sold, 
                    SUM(ip.quantity * ip.price) as total_revenue 
                FROM invoice_products ip 
                JOIN invoices i ON ip.invoice_id = i.id 
                JOIN products p ON ip.product_id = p.id 
                ${whereClause}
                GROUP BY p.id 
                ORDER BY ${orderBy}
            `;

            const data = await db.all(query, params);
            setSalesData(data || []);
        } catch (err) { console.error(err); }
    };

    useEffect(() => { loadProducts(); }, [search, sortBy, filterStatus]);
    useEffect(() => { loadProductStats(); }, [statsPeriod]);
    useEffect(() => { if (isSalesModalOpen) loadSalesData(); }, [salesStatsPeriod, isSalesModalOpen, salesSearch, salesSortBy, salesStartDate, salesEndDate]);

    // Live refresh listener
    useEffect(() => {
        const handleRefresh = () => {
            loadProducts();
            loadProductStats();
            if (isSalesModalOpen) loadSalesData();
        };
        window.addEventListener('db-update', handleRefresh);
        return () => window.removeEventListener('db-update', handleRefresh);
    }, [search, sortBy, filterStatus, statsPeriod, isSalesModalOpen, salesStatsPeriod, salesSearch, salesSortBy, salesStartDate, salesEndDate]);

    const deleteProduct = async (id) => {
        requestSecureAction(async () => {
            try {
                // Delete invoice associations first
                await db.run("DELETE FROM invoice_products WHERE product_id = ?", [id]);
                await db.run("DELETE FROM products WHERE id = ?", [id]);
                setDeleteConfirm(null);
                loadProducts();
                loadProductStats();
            } catch (err) {
                console.error(err);
                setDeleteConfirm(null);
            }
        }, 'Delete Product');
    };

    const handleEdit = (p) => {
        requestSecureAction(() => {
            setEditingProduct(p);
            setFormData({ name: p.name, price: p.price, stock: p.stock });
            setIsModalOpen(true);
        }, 'Edit Product');
    };

    const openAddModal = () => {
        setEditingProduct(null);
        setFormData({ name: '', price: '', stock: '' });
        setIsModalOpen(true);
        loadProducts();
        loadProductStats();
    };

    const openSalesModal = () => {
        setSalesStatsPeriod('Daily');
        setSalesSearch('');
        setSalesStartDate('');
        setSalesEndDate('');
        setSalesSortBy('revenue-desc');
        setIsSalesModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingProduct) {
                await db.run("UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?",
                    [formData.name, formData.price, formData.stock, editingProduct.id]);
                setEditingProduct(null);
            } else {
                await db.run("INSERT INTO products (name, price, stock) VALUES (?, ?, ?)",
                    [formData.name, formData.price, formData.stock]);
            }
            setFormData({ name: '', price: '', stock: '' });
            setIsModalOpen(false);
            loadProducts();
        } catch (err) { console.error(err); }
    };

    const updateStock = async (id, newStock) => {
        requestSecureAction(async () => {
            await db.run("UPDATE products SET stock = ? WHERE id = ?", [newStock, id]);
            loadProducts();
        }, 'Update Product Stock');
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 font-sans overflow-y-auto custom-scrollbar">
            <h1 className="text-4xl font-bold text-cyan-400 font-sans tracking-tight mb-2">Products</h1>
            {/* Product Statistics Section */}
            <div className="bg-[#121826] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-white font-sans tracking-wider">Inventory Overview</h2>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (!showStats) {
                                    requestSecureAction(() => setShowStats(true), "View Inventory Overview");
                                } else {
                                    setShowStats(false);
                                }
                            }}
                            className="bg-[#1a2233] hover:bg-gray-800 text-white p-2 rounded-xl border border-gray-700 transition-all flex items-center gap-2 text-sm font-semibold"
                        >
                            {showStats ? <EyeOff size={18} /> : <Eye size={18} />}
                            {showStats ? 'Hide Stats' : 'Show Stats'}
                        </button>
                        <div className="flex bg-[#1a2233] p-1 rounded-xl border border-gray-700">
                            {['Daily', 'Weekly', 'Monthly', 'Annual'].map(period => (
                                <button
                                    key={period}
                                    onClick={() => setStatsPeriod(period)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${statsPeriod === period ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {showStats && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-indigo-500/30 transition-all">
                            <span className="text-gray-400 text-lg font-semibold mb-2 uppercase tracking-wide">Total Products</span>
                            <h3 className="text-3xl font-semibold text-white font-sans tracking-tight">{productStats.total}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-violet-500/30 transition-all">
                            <span className="text-gray-400 text-lg font-semibold mb-2 uppercase tracking-wide">Total Sales</span>
                            <h3 className="text-3xl font-semibold text-violet-400 font-sans tracking-tight">Rs. {productStats.totalRevenue.toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-rose-500/30 transition-all">
                            <span className="text-gray-400 text-lg font-semibold mb-2 uppercase tracking-wide font-poppins">Discounts</span>
                            <h3 className="text-3xl font-semibold text-rose-500 font-sans tracking-tight leading-none">Rs. {Math.round(productStats.totalDiscount || 0).toLocaleString()}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all">
                            <span className="text-gray-400 text-lg font-semibold mb-2 uppercase tracking-wide">Most Popular</span>
                            <h3 className="text-3xl font-semibold text-emerald-500 font-sans tracking-tight">{productStats.topSold}</h3>
                        </div>
                        <div className="bg-[#0f1420] border border-gray-800/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-blue-500/30 transition-all border-l-4 border-l-blue-500/20">
                            <span className="text-gray-400 text-lg font-semibold mb-2 uppercase tracking-wide">Total Sold</span>
                            <h3 className="text-3xl font-semibold text-blue-400 font-sans tracking-tight">{productStats.periodSales || 0}</h3>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center bg-secondary-bg p-4 rounded-2xl border border-gray-800 shadow-lg">
                <div className="flex items-center gap-4 flex-1 max-w-2xl px-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full bg-primary-bg pl-10 pr-4 py-2.5 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-24 cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all" className="bg-gray-900">All Stock</option>
                            <option value="in-stock" className="bg-gray-900">In Stock</option>
                            <option value="low" className="bg-gray-900">Low Stock</option>
                            <option value="out" className="bg-gray-900">Out of Stock</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-primary-bg border border-gray-700 rounded-xl px-3 py-2.5">
                        <Filter size={18} className="text-gray-400" />
                        <select
                            className="bg-transparent text-sm text-gray-100 outline-none w-32 cursor-pointer"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="latest" className="bg-gray-900">Latest First</option>
                            <option value="alpha" className="bg-gray-900">Name (A-Z)</option>
                            <option value="price-asc" className="bg-gray-900">Price: Low to High</option>
                            <option value="price-desc" className="bg-gray-900">Price: High to Low</option>
                            <option value="stock-low" className="bg-gray-900">Stock: Low First</option>
                            <option value="revenue-desc" className="bg-gray-900">Revenue: High to Low</option>
                            <option value="revenue-asc" className="bg-gray-900">Revenue: Low to High</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={openSalesModal}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all"
                    >
                        <BarChart2 size={20} /> Item Sales
                    </button>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-all"
                    >
                        <Plus size={20} /> Add New Product
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-1">
                <span className="text-white font-semibold text-sm">Count:</span>
                <span className="text-white font-semibold text-sm">{products.length}</span>
            </div>

            <div className="flex flex-1 gap-6 min-h-[500px]">
                <div className="flex-1 bg-secondary-bg border border-gray-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left text-gray-300 table-fixed">
                            <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                                <tr>
                                    <th className="table-header-cell w-1/6">Product Name</th>
                                    <th className="table-header-cell text-center w-1/6">Stock</th>
                                    <th className="table-header-cell text-center w-1/6">Sold</th>
                                    <th className="table-header-cell text-center w-1/6">Price</th>
                                    <th className="table-header-cell text-center w-1/6">Revenue</th>
                                    <th className="table-header-cell text-center w-1/6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {products.length === 0 ? (
                                    <tr><td colSpan="6" className="p-10 text-center text-gray-500 italic">No products found.</td></tr>
                                ) : (
                                    products.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-800/30 transition-colors group">
                                            <td className="table-data-cell">
                                                <div className="text-white text-sm">{p.name}</div>
                                            </td>
                                            <td className="table-data-cell text-center">
                                                <span className={`text-sm font-semibold ${p.stock <= 5 ? 'text-red-500' : 'text-emerald-400'}`}>
                                                    {p.stock} Units
                                                </span>
                                            </td>
                                            <td className="table-data-cell text-center">
                                                <span className="text-white text-sm">{p.sold_count}</span>
                                            </td>
                                            <td className="table-data-cell text-center">
                                                <span className="text-white text-sm">Rs. {p.price}</span>
                                            </td>
                                            <td className="table-data-cell text-center">
                                                <span className="text-emerald-400 text-sm font-semibold">Rs. {(p.price * p.sold_count).toLocaleString()}</span>
                                            </td>
                                            <td className="table-data-cell">
                                                <div className="flex items-center justify-center gap-2 transition-opacity">
                                                    {deleteConfirm === p.id ? (
                                                        <div className="flex items-center gap-1 bg-rose-500/10 p-1 rounded-xl border border-rose-500/20">
                                                            <button
                                                                onClick={() => deleteProduct(p.id)}
                                                                className="p-1.5 text-emerald-400 hover:bg-emerald-400/20 rounded-lg transition-all"
                                                                title="Confirm Delete"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(null)}
                                                                className="p-1.5 text-rose-400 hover:bg-rose-400/20 rounded-lg transition-all"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleEdit(p)}
                                                                className="p-2 text-white hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                                title="Edit Product"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(p.id)}
                                                                className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Delete Product"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? "Edit Product" : "Add New Product"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Product Name</label>
                        <input
                            required
                            className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 font-poppins mb-2 px-1">Price (Rs.)</label>
                        <input
                            required
                            type="number"
                            className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500 font-poppins mb-2 px-1">Stock</label>
                        <input
                            required
                            type="number"
                            className="w-full bg-primary-bg p-3 rounded-xl border border-gray-700 text-white outline-none focus:border-teal-500"
                            value={formData.stock}
                            onChange={e => setFormData({ ...formData, stock: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all">Cancel</button>
                        <button type="submit" className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all">
                            {editingProduct ? 'Update Product' : 'Save Product'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Sales Stats Modal */}
            {
                isSalesModalOpen && (
                    <div onClick={(e) => { if (e.target === e.currentTarget) setIsSalesModalOpen(false); }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-secondary-bg w-full max-w-6xl rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
                            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <BarChart2 className="text-blue-400" /> Product Sales Analysis
                                </h3>
                                <button onClick={() => setIsSalesModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-4 border-b border-gray-800 bg-gray-900/30 flex flex-col md:flex-row justify-between items-start gap-4">
                                <div className="flex flex-col gap-3">
                                    <div className="flex bg-[#1a2233] p-1 rounded-xl border border-gray-700 w-fit">
                                        {['Daily', 'Weekly', 'Monthly', 'Annual', 'Custom'].map(period => (
                                            <button
                                                key={period}
                                                onClick={() => setSalesStatsPeriod(period)}
                                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${salesStatsPeriod === period ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {period}
                                            </button>
                                        ))}
                                    </div>
                                    {salesStatsPeriod === 'Custom' && (
                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <input
                                                type="date"
                                                value={salesStartDate}
                                                onChange={(e) => setSalesStartDate(e.target.value)}
                                                className="bg-[#1a2233] border border-gray-700 text-white text-sm rounded-lg p-2 outline-none focus:border-blue-500"
                                            />
                                            <span className="text-gray-400">-</span>
                                            <input
                                                type="date"
                                                value={salesEndDate}
                                                onChange={(e) => setSalesEndDate(e.target.value)}
                                                className="bg-[#1a2233] border border-gray-700 text-white text-sm rounded-lg p-2 outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-4 w-full md:w-auto items-center mt-1">
                                    <select
                                        value={salesSortBy}
                                        onChange={(e) => setSalesSortBy(e.target.value)}
                                        className="bg-[#1a2233] px-3 py-2 rounded-xl border border-gray-700 text-white text-sm outline-none focus:border-blue-500 transition-all cursor-pointer h-10"
                                    >
                                        <option value="revenue-desc">Revenue (High to Low)</option>
                                        <option value="revenue-asc">Revenue (Low to High)</option>
                                        <option value="quantity-desc">Units (High to Low)</option>
                                        <option value="quantity-asc">Units (Low to High)</option>
                                        <option value="price-desc">Price (High to Low)</option>
                                        <option value="price-asc">Price (Low to High)</option>
                                        <option value="name-asc">Name (A-Z)</option>
                                        <option value="name-desc">Name (Z-A)</option>
                                    </select>
                                    <div className="relative w-full md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search sales..."
                                            className="w-full bg-[#1a2233] pl-9 pr-4 py-2 rounded-xl border border-gray-700 text-white text-sm outline-none focus:border-blue-500 transition-all placeholder-gray-500 h-10"
                                            value={salesSearch}
                                            onChange={(e) => setSalesSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-6 pb-0">
                                <div className="bg-[#1a2233] p-4 rounded-xl border border-gray-700">
                                    <div className="text-gray-400 text-sm font-bold uppercase mb-1">Total Revenue</div>
                                    <div className="text-2xl font-bold text-emerald-400">Rs. {salesData.reduce((sum, item) => sum + item.total_revenue, 0).toLocaleString()}</div>
                                </div>
                                <div className="bg-[#1a2233] p-4 rounded-xl border border-gray-700">
                                    <div className="text-gray-400 text-sm font-bold uppercase mb-1">Total Units Sold</div>
                                    <div className="text-2xl font-bold text-blue-400">{salesData.reduce((sum, item) => sum + item.quantity_sold, 0)}</div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="bg-secondary-bg border border-gray-800 rounded-2xl flex flex-col shadow-xl overflow-hidden">
                                    <table className="w-full text-left text-gray-300 table-fixed">
                                        <thead className="table-header sticky top-0 z-10 bg-[#121826]">
                                            <tr>
                                                <th className="table-header-cell">Product Name</th>
                                                <th className="table-header-cell text-center">Price</th>
                                                <th className="table-header-cell text-center">Units Sold</th>
                                                <th className="table-header-cell text-right">Revenue Generated</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/10">
                                            {salesData.length === 0 ? (
                                                <tr><td colSpan="4" className="p-10 text-center text-gray-500 italic">No sales data found for this period.</td></tr>
                                            ) : (
                                                salesData.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-800/30 transition-colors group">
                                                        <td className="table-data-cell">
                                                            <div className="text-white text-sm">{item.name}</div>
                                                        </td>
                                                        <td className="table-data-cell text-center">
                                                            <span className="text-amber-500 text-sm font-semibold">Rs. {item.price.toLocaleString()}</span>
                                                        </td>
                                                        <td className="table-data-cell text-center">
                                                            <span className="text-blue-400 text-sm font-semibold">{item.quantity_sold}</span>
                                                        </td>
                                                        <td className="table-data-cell text-right">
                                                            <span className="text-emerald-400 text-sm font-semibold">Rs. {item.total_revenue.toLocaleString()}</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            <PasswordModal
                isOpen={secureAction.isOpen}
                onClose={() => setSecureAction({ ...secureAction, isOpen: false })}
                onVerified={secureAction.onVerified}
                actionName={secureAction.actionName}
            />
        </div >
    );
};

export default Products;

