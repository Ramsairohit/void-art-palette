import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/inventory/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Package, Save } from 'lucide-react';
import { z } from 'zod';

interface Category {
  id: string;
  name: string;
}

// Validation schema
const itemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  category_id: z.string().optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  min_quantity: z.number().min(0, 'Min quantity cannot be negative'),
  supplier: z.string().max(100, 'Supplier name is too long').optional(),
  unit_price: z.number().min(0, 'Price cannot be negative').optional(),
  sku: z.string().max(50, 'SKU is too long').optional(),
});

const InventoryForm = () => {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    quantity: 0,
    min_quantity: 5,
    supplier: '',
    unit_price: 0,
    sku: '',
  });

  useEffect(() => {
    fetchCategories();
    if (isEditing) {
      fetchItem();
    }
  }, [id]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
  };

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          description: data.description || '',
          category_id: data.category_id || '',
          quantity: data.quantity,
          min_quantity: data.min_quantity,
          supplier: data.supplier || '',
          unit_price: Number(data.unit_price) || 0,
          sku: data.sku || '',
        });
      }
    } catch (error) {
      console.error('Error fetching item:', error);
      toast({
        title: 'Error',
        description: 'Failed to load item details',
        variant: 'destructive',
      });
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const result = itemSchema.safeParse({
      ...formData,
      quantity: Number(formData.quantity),
      min_quantity: Number(formData.min_quantity),
      unit_price: Number(formData.unit_price),
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        category_id: formData.category_id || null,
        quantity: Number(formData.quantity),
        min_quantity: Number(formData.min_quantity),
        supplier: formData.supplier.trim() || null,
        unit_price: Number(formData.unit_price) || 0,
        sku: formData.sku.trim() || null,
        updated_by: user?.id,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Item updated',
          description: `${formData.name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase.from('inventory_items').insert({
          ...itemData,
          created_by: user?.id,
        });

        if (error) throw error;

        toast({
          title: 'Item created',
          description: `${formData.name} has been added to inventory.`,
        });
      }

      navigate('/inventory');
    } catch (error: any) {
      console.error('Error saving item:', error);
      let message = 'Failed to save item';
      if (error.message?.includes('duplicate')) {
        message = 'An item with this SKU already exists';
        setErrors({ sku: message });
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
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
      <div className="max-w-2xl mx-auto animate-fade-in-up">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/inventory')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>{isEditing ? 'Edit Item' : 'Add New Item'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter item name"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter item description"
                    rows={3}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  {errors.description && (
                    <p className="text-sm text-destructive">{errors.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category_id">Category</Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="e.g., SKU-001"
                    className={errors.sku ? 'border-destructive' : ''}
                  />
                  {errors.sku && (
                    <p className="text-sm text-destructive">{errors.sku}</p>
                  )}
                </div>
              </div>

              {/* Quantity & Pricing */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={handleChange}
                    className={errors.quantity ? 'border-destructive' : ''}
                  />
                  {errors.quantity && (
                    <p className="text-sm text-destructive">{errors.quantity}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_quantity">Min Quantity</Label>
                  <Input
                    id="min_quantity"
                    name="min_quantity"
                    type="number"
                    min="0"
                    value={formData.min_quantity}
                    onChange={handleChange}
                    className={errors.min_quantity ? 'border-destructive' : ''}
                  />
                  <p className="text-xs text-muted-foreground">
                    Alert threshold
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price ($)</Label>
                  <Input
                    id="unit_price"
                    name="unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={handleChange}
                    className={errors.unit_price ? 'border-destructive' : ''}
                  />
                </div>
              </div>

              {/* Supplier */}
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  placeholder="Enter supplier name"
                  className={errors.supplier ? 'border-destructive' : ''}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventory')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {isEditing ? 'Update Item' : 'Create Item'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default InventoryForm;
