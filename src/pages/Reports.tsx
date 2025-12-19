import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/inventory/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Loader2,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface CategoryStats {
  name: string;
  count: number;
  value: number;
}

interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  categoryStats: CategoryStats[];
  stockDistribution: { name: string; value: number }[];
}

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(262, 83%, 58%)', 'hsl(0, 84%, 60%)'];

const Reports = () => {
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    try {
      // Fetch all inventory items with category info
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          quantity,
          min_quantity,
          unit_price,
          category:categories (id, name)
        `);

      if (itemsError) throw itemsError;

      // Fetch categories
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, name');

      if (catError) throw catError;

      // Calculate statistics
      const totalItems = items?.length || 0;
      const totalValue = items?.reduce((sum, item) => {
        return sum + (item.quantity * (Number(item.unit_price) || 0));
      }, 0) || 0;
      const lowStockCount = items?.filter(item => item.quantity <= item.min_quantity).length || 0;

      // Category breakdown
      const categoryMap = new Map<string, { count: number; value: number }>();
      categories?.forEach(cat => {
        categoryMap.set(cat.name, { count: 0, value: 0 });
      });

      items?.forEach(item => {
        const catName = item.category?.name || 'Uncategorized';
        const existing = categoryMap.get(catName) || { count: 0, value: 0 };
        categoryMap.set(catName, {
          count: existing.count + 1,
          value: existing.value + (item.quantity * (Number(item.unit_price) || 0)),
        });
      });

      const categoryStats: CategoryStats[] = Array.from(categoryMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        value: data.value,
      })).filter(c => c.count > 0);

      // Stock distribution
      const inStock = items?.filter(item => item.quantity > item.min_quantity).length || 0;
      const lowStock = lowStockCount;
      const outOfStock = items?.filter(item => item.quantity === 0).length || 0;

      const stockDistribution = [
        { name: 'In Stock', value: inStock - outOfStock },
        { name: 'Low Stock', value: lowStock },
        { name: 'Out of Stock', value: outOfStock },
      ].filter(s => s.value > 0);

      setStats({
        totalItems,
        totalValue,
        lowStockCount,
        categoryStats,
        stockDistribution,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-dashboard-heading">Reports</h2>
            <p className="text-muted-foreground mt-1">
              Inventory analytics and insights
            </p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Items
              </CardTitle>
              <Package className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalItems || 0}</div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
              <DollarSign className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Items
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{stats?.lowStockCount || 0}</div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.categoryStats.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category Breakdown Bar Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <CardTitle>Items by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.categoryStats && stats.categoryStats.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={stats.categoryStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" className="text-muted-foreground text-xs" />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        className="text-muted-foreground text-xs"
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(221, 83%, 53%)" 
                        radius={[0, 4, 4, 0]}
                        name="Items"
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Distribution Pie Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              <CardTitle>Stock Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.stockDistribution && stats.stockDistribution.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.stockDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {stats.stockDistribution.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChartIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category Value Table */}
        <Card>
          <CardHeader>
            <CardTitle>Category Value Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Items</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total Value</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.categoryStats.map((cat, index) => (
                    <tr key={cat.name} className="border-b border-border last:border-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">{cat.count}</td>
                      <td className="text-right py-3 px-4 font-medium">{formatCurrency(cat.value)}</td>
                      <td className="text-right py-3 px-4 text-muted-foreground">
                        {stats.totalValue > 0 ? ((cat.value / stats.totalValue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
