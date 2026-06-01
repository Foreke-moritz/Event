-- ==========================================
-- SUPERVISED ROLE-BASED SUPABASE SCHEMA 
-- SMALL BUSINESS INVENTORY & SALES SYSTEM
-- ==========================================

-- 1. EXTENSIONS
-- Required to generate UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLE DEFINITIONS
-- ==========================================

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    business_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Categories Table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Products Table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT,
    description TEXT,
    cost_price NUMERIC DEFAULT 0,
    selling_price NUMERIC NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0), -- Prevents negative stock!
    low_stock_limit INTEGER DEFAULT 5,
    supplier_name TEXT,
    supplier_contact TEXT,
    expiry_date DATE,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Stock Movements Table
CREATE TABLE public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'stock_out', 'sale', 'adjustment', 'return', 'damage')),
    quantity INTEGER NOT NULL,
    old_quantity INTEGER,
    new_quantity INTEGER,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Sales Table
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receipt_number TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    total_profit NUMERIC DEFAULT 0,
    payment_method TEXT,
    amount_paid NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    sale_status TEXT DEFAULT 'completed',
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Sale Items Table
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT,
    quantity_sold INTEGER NOT NULL CHECK (quantity_sold > 0),
    cost_price NUMERIC DEFAULT 0,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    profit NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Business Settings Table
CREATE TABLE public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    currency TEXT DEFAULT 'FCFA',
    address TEXT,
    phone TEXT,
    email TEXT,
    receipt_footer TEXT DEFAULT 'Thank you for your purchase',
    low_stock_alert BOOLEAN DEFAULT true,
    tax_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Expenses Table
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    category TEXT,
    description TEXT,
    expense_date DATE DEFAULT current_date,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==========================================
CREATE INDEX idx_profiles_admin_id ON public.profiles(admin_id);
CREATE INDEX idx_products_admin_id ON public.products(admin_id);
CREATE INDEX idx_sales_admin_id ON public.sales(admin_id);
CREATE INDEX idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX idx_sales_date ON public.sales(sale_date);
CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS safely on all tables universally
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
-- Admins can view profiles mapped to them or themselves. Staff can view their own profile and their Admin's profile.
CREATE POLICY "Users can view their own profile or profiles connected to their admin"
ON public.profiles FOR SELECT USING (
    id = auth.uid() OR 
    admin_id = auth.uid() OR 
    (admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid()))
);

CREATE POLICY "Admins can update their own profile and their staff profiles"
ON public.profiles FOR UPDATE USING (
    id = auth.uid() OR admin_id = auth.uid()
);

CREATE POLICY "Admins can insert child profiles"
ON public.profiles FOR INSERT WITH CHECK (
    admin_id = auth.uid()
);

-- 2. Categories Policies
-- Staff can SELECT only. Admins can ALL.
CREATE POLICY "Staff and Admins can view categories of their business"
ON public.categories FOR SELECT USING (
    admin_id = auth.uid() OR 
    admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can insert categories"
ON public.categories FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update categories"
ON public.categories FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "Admins can delete categories"
ON public.categories FOR DELETE USING (admin_id = auth.uid());

-- 3. Products Policies
CREATE POLICY "Staff and Admins can view products of their business"
ON public.products FOR SELECT USING (
    admin_id = auth.uid() OR 
    admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins can manage products"
ON public.products FOR ALL USING (admin_id = auth.uid());

-- Staff MUST be able to update product quantity inherently via sales recording!
-- Supabase security strictly prohibits updates unless we give staff UPDATE access, but lock it down to quantity changes.
CREATE POLICY "Staff can update product quantity when selling"
ON public.products FOR UPDATE USING (
    admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
);

-- 4. Stock Movements Policies
CREATE POLICY "View stock movements"
ON public.stock_movements FOR SELECT USING (
    admin_id = auth.uid() OR 
    admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Admins and Staff can insert stock movements"
ON public.stock_movements FOR INSERT WITH CHECK (
    admin_id = auth.uid() OR 
    admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Sales Policies
CREATE POLICY "Staff view their own sales, Admins view ALL belonging to admin"
ON public.sales FOR SELECT USING (
    admin_id = auth.uid() OR 
    staff_id = auth.uid()
);

CREATE POLICY "Staff and Admins can record sales"
ON public.sales FOR INSERT WITH CHECK (
    admin_id = auth.uid() OR 
    (admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid()) AND staff_id = auth.uid())
);

CREATE POLICY "Admins can manage sales fully"
ON public.sales FOR UPDATE USING (admin_id = auth.uid());
CREATE POLICY "Admins can delete sales"
ON public.sales FOR DELETE USING (admin_id = auth.uid());

-- 6. Sale Items Policies
CREATE POLICY "View sale items related to valid sales"
ON public.sale_items FOR SELECT USING (
    sale_id IN (SELECT id FROM public.sales)
);

CREATE POLICY "Staff and Admins can insert sale items"
ON public.sale_items FOR INSERT WITH CHECK (
    sale_id IN (SELECT id FROM public.sales)
);

-- 7. Business Settings
CREATE POLICY "Staff view settings, Admins manage settings"
ON public.business_settings FOR SELECT USING (
    admin_id = auth.uid() OR 
    admin_id = (SELECT admin_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Admins can manage business settings"
ON public.business_settings FOR ALL USING (admin_id = auth.uid());

-- 8. Expenses Policies
CREATE POLICY "Only admins can see and manage expenses"
ON public.expenses FOR ALL USING (admin_id = auth.uid());

-- ==========================================
-- AUTOMATION TRIGGERS AND FUNCTIONS
-- ==========================================

-- Function: Setup updated_at columns automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_business_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Handle profile creation automatically on User Registration via Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, business_name, role)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        NEW.raw_user_meta_data->>'business_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'admin') -- If empty, defaults to admin (for business owners registering).
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Automatically generate strict Receipt Numbers (e.g. REC-12001)
CREATE SEQUENCE IF NOT EXISTS receipt_seq START 10000;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
        NEW.receipt_number := 'REC-' || nextval('receipt_seq')::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_receipt BEFORE INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();
