-- Helper function to avoid infinite recursion in RLS
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (auth.uid() = id OR get_user_role() = 'admin');

CREATE POLICY "profiles_insert" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE USING (auth.uid() = id OR get_user_role() = 'admin');

-- Allow admins to archive/restore users by updating the is_archived flag
CREATE POLICY "profiles_archive_by_admin" ON profiles
    FOR UPDATE USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');

-- Prevent direct DELETEs; archiving is preferred.
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories
    FOR SELECT USING (true);

CREATE POLICY "categories_insert" ON categories
    FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "categories_update" ON categories
    FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "categories_delete" ON categories
    FOR DELETE USING (get_user_role() = 'admin');

-- menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items_select" ON menu_items
    FOR SELECT USING (true);

CREATE POLICY "menu_items_insert" ON menu_items
    FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "menu_items_update" ON menu_items
    FOR UPDATE USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "menu_items_delete" ON menu_items
    FOR DELETE USING (get_user_role() = 'admin');

-- tables
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables_select" ON tables
    FOR SELECT USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "tables_insert" ON tables
    FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "tables_update" ON tables
    FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "tables_delete" ON tables
    FOR DELETE USING (get_user_role() = 'admin');

-- table_sessions
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_sessions_select_staff" ON table_sessions
    FOR SELECT USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "table_sessions_select_customer" ON table_sessions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM session_devices WHERE session_id = table_sessions.id
        AND device_fingerprint = current_setting('app.device_fingerprint', true)
    ));

CREATE POLICY "table_sessions_insert" ON table_sessions
    FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "table_sessions_update" ON table_sessions
    FOR UPDATE USING (get_user_role() IN ('admin', 'staff'));

-- session_devices
ALTER TABLE session_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_devices_select" ON session_devices
    FOR SELECT USING (get_user_role() IN ('admin', 'staff') OR device_fingerprint = current_setting('app.device_fingerprint', true));

CREATE POLICY "session_devices_insert" ON session_devices
    FOR INSERT WITH CHECK (true);

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_staff" ON orders
    FOR SELECT USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "orders_select_customer" ON orders
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM session_devices
        JOIN table_sessions ON table_sessions.id = session_devices.session_id
        WHERE table_sessions.id = orders.session_id
        AND session_devices.device_fingerprint = current_setting('app.device_fingerprint', true)
    ));

CREATE POLICY "orders_insert" ON orders
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM session_devices
        JOIN table_sessions ON table_sessions.id = session_devices.session_id
        WHERE table_sessions.id = orders.session_id
        AND session_devices.device_fingerprint = current_setting('app.device_fingerprint', true)
    ));

CREATE POLICY "orders_update" ON orders
    FOR UPDATE USING (get_user_role() IN ('admin', 'staff'));

-- order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select_staff" ON order_items
    FOR SELECT USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "order_items_select_customer" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders
        JOIN table_sessions ON table_sessions.id = orders.session_id
        JOIN session_devices ON session_devices.session_id = table_sessions.id
        WHERE orders.id = order_items.order_id
        AND session_devices.device_fingerprint = current_setting('app.device_fingerprint', true)
    ));

CREATE POLICY "order_items_insert" ON order_items
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM orders
        JOIN table_sessions ON table_sessions.id = orders.session_id
        JOIN session_devices ON session_devices.session_id = table_sessions.id
        WHERE orders.id = order_items.order_id
        AND session_devices.device_fingerprint = current_setting('app.device_fingerprint', true)
    ));

CREATE POLICY "order_items_update" ON order_items
    FOR UPDATE USING (get_user_role() IN ('admin', 'staff'));

-- shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_select" ON shifts
    FOR SELECT USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "shifts_insert" ON shifts
    FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "shifts_update" ON shifts
    FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "shifts_delete" ON shifts
    FOR DELETE USING (get_user_role() = 'admin');

-- shift_switch_requests
ALTER TABLE shift_switch_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssr_select" ON shift_switch_requests
    FOR SELECT USING (get_user_role() IN ('admin', 'staff'));

CREATE POLICY "ssr_insert" ON shift_switch_requests
    FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "ssr_update" ON shift_switch_requests
    FOR UPDATE USING (
        auth.uid() = target_id
        OR get_user_role() = 'admin'
    );

-- surplus_items
ALTER TABLE surplus_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surplus_select" ON surplus_items
    FOR SELECT USING (true);

CREATE POLICY "surplus_insert" ON surplus_items
    FOR INSERT WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "surplus_update" ON surplus_items
    FOR UPDATE USING (get_user_role() = 'admin');

CREATE POLICY "surplus_delete" ON surplus_items
    FOR DELETE USING (get_user_role() = 'admin');