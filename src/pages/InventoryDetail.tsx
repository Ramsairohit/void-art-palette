import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/inventory/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  Loader2,
  Calendar,
  Tag,
  Building2,
  Hash,
  DollarSign,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  min_quantity: number;
  supplier: string | null;
  unit_price: number | null;
  sku: string | null;
  created_at: string;
  updated_at: string;
  category: {
    id: string;
    name: string;
  } | null;
}

const InventoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          name,
          description,
          quantity,
          min_quantity,
          supplier,
          unit_price,
          sku,
          created_at,
          updated_at,
          category:categories (id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);
    } catch (error) {
      console.error('Error fetching item:', error);
      toast({
        title: 'Error',
        description: 'Item not found',
        variant: 'destructive',
      });
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: 'Item deleted',
        description: `${item.name} has been removed from inventory.`,
      });
      navigate('/inventory');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete item',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
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

  if (!item) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Item not found</p>
          <Link to="/inventory">
            <Button variant="link">Go back to inventory</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const isLowStock = item.quantity <= item.min_quantity;
  const totalValue = (item.quantity * (item.unit_price || 0));

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto animate-fade-in-up">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/inventory')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>

        {/* Header Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 shrink-0">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    {item.name}
                    {isLowStock && (
                      <span className="low-stock-badge">
                        <AlertTriangle className="h-3 w-3" />
                        Low Stock
                      </span>
                    )}
                  </CardTitle>
                  {item.category && (
                    <Badge variant="secondary" className="mt-2">
                      {item.category.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/inventory/${item.id}/edit`}>
                  <Button variant="outline" className="gap-2">
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </Link>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          {item.description && (
            <CardContent>
              <p className="text-muted-foreground">{item.description}</p>
            </CardContent>
          )}
        </Card>

        {/* Details Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">SKU</p>
                    <p className="font-mono font-medium">{item.sku || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tag className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <p className="font-medium">{item.category?.name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">{item.supplier || '-'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Package className={`h-5 w-5 ${isLowStock ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className={`font-medium text-lg ${isLowStock ? 'text-destructive' : ''}`}>
                      {item.quantity} units
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Min threshold: {item.min_quantity}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Unit Price</p>
                    <p className="font-medium">{formatCurrency(item.unit_price)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="font-medium text-success">{formatCurrency(totalValue)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timestamps */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{format(new Date(item.created_at), 'PPP p')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last updated:</span>
                <span>{format(new Date(item.updated_at), 'PPP p')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{item.name}"? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default InventoryDetail;
