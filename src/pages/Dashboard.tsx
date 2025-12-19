import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/inventory/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  categoriesCount: number;
}

interface RecentActivity {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  user_id: string | null;
  new_data: Record<string, unknown> | null;
  userName: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    totalValue: 0,
    categoriesCount: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [lowStockList, setLowStockList] = useState<{ id: string; name: string; quantity: number; min_quantity: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch inventory stats
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('quantity, min_quantity, unit_price, name, id');

      if (itemsError) throw itemsError;

      // Fetch categories count
      const { count: categoriesCount, error: catError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true });

      if (catError) throw catError;

      // Fetch recent activity (without join)
      const { data: activities, error: actError } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, created_at, new_data, user_id')
        .order('created_at', { ascending: false })
        .limit(5);

      if (actError) throw actError;

      // Fetch profiles for the user_ids in activities
      const userIds = [...new Set(activities?.map(a => a.user_id).filter(Boolean) as string[])];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email.split('@')[0];
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Map activities with user names
      const mappedActivities: RecentActivity[] = (activities || []).map(activity => ({
        id: activity.id,
        action: activity.action,
        table_name: activity.table_name,
        created_at: activity.created_at,
        user_id: activity.user_id,
        new_data: activity.new_data as Record<string, unknown> | null,
        userName: activity.user_id ? profilesMap[activity.user_id] || 'Unknown' : 'System',
      }));

      // Calculate stats
      const totalItems = items?.length || 0;
      const lowStock = items?.filter(item => item.quantity <= item.min_quantity) || [];
      const totalValue = items?.reduce((sum, item) => {
        return sum + (item.quantity * (Number(item.unit_price) || 0));
      }, 0) || 0;

      setStats({
        totalItems,
        lowStockItems: lowStock.length,
        totalValue,
        categoriesCount: categoriesCount || 0,
      });

      setLowStockList(lowStock.slice(0, 5).map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        min_quantity: item.min_quantity,
      })));

      setRecentActivity(mappedActivities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'INSERT': return 'Added';
      case 'UPDATE': return 'Updated';
      case 'DELETE': return 'Deleted';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'text-success';
      case 'UPDATE': return 'text-info';
      case 'DELETE': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getItemName = (newData: Record<string, unknown> | null): string => {
    if (!newData) return 'item';
    return typeof newData.name === 'string' ? newData.name : 'item';
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
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-dashboard-heading">Welcome back!</h2>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your inventory today.
            </p>
          </div>
          <Link to="/inventory/new">
            <Button className="gap-2">
              <Package className="h-4 w-4" />
              Add New Item
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Items
              </CardTitle>
              <Package className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-stat-value">{stats.totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {stats.categoriesCount} categories
              </p>
            </CardContent>
          </Card>

          <Card className={`stat-card ${stats.lowStockItems > 0 ? 'border-warning/50' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Alerts
              </CardTitle>
              <AlertTriangle className={`h-5 w-5 ${stats.lowStockItems > 0 ? 'text-warning animate-pulse-soft' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-stat-value ${stats.lowStockItems > 0 ? 'text-warning' : ''}`}>
                {stats.lowStockItems}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Items below threshold
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inventory Value
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-stat-value">{formatCurrency(stats.totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-success" />
                Total stock value
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Categories
              </CardTitle>
              <Package className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-stat-value">{stats.categoriesCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active categories
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Low Stock Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Low Stock Items</CardTitle>
              <Link to="/inventory?filter=low-stock">
                <Button variant="ghost" size="sm" className="text-primary">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {lowStockList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No low stock items</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockList.map((item) => (
                    <Link
                      key={item.id}
                      to={`/inventory/${item.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Min: {item.min_quantity} units
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="low-stock-badge">
                          <ArrowDownRight className="h-3 w-3" />
                          {item.quantity} left
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <Link to="/audit-log">
                <Button variant="ghost" size="sm" className="text-primary">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <div className={`mt-0.5 ${getActionColor(activity.action)}`}>
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className={`font-medium ${getActionColor(activity.action)}`}>
                            {getActionLabel(activity.action)}
                          </span>{' '}
                          <span className="text-foreground">
                            {getItemName(activity.new_data)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {activity.userName} • {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Admin Notice */}
        {isAdmin && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Admin Access</p>
                  <p className="text-sm text-muted-foreground">
                    You have full access to manage inventory, delete items, and view all audit logs.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
