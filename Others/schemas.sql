CREATE TABLE public.profiles (
    id UUID NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    phone BIGINT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT profiles_pkey PRIMARY KEY (id),

    CONSTRAINT profiles_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users (id)
        ON DELETE CASCADE,

    CONSTRAINT profiles_role_check
        CHECK (
            role = ANY (
                ARRAY['admin'::TEXT, 'staff'::TEXT]
            )
        )
);

CREATE TABLE categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    is_available boolean NOT NULL DEFAULT true,
    is_archived boolean NOT NULL DEFAULT false,
    prep_time_minutes integer NOT NULL DEFAULT 15,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number integer NOT NULL UNIQUE,
    capacity integer NOT NULL,
    qr_code_url text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE table_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id uuid NOT NULL REFERENCES tables(id),
    pin char(4) NOT NULL,
    status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'open', 'locked', 'completed', 'cleared')),
    opened_at timestamptz,
    completed_at timestamptz,
    cleared_at timestamptz,
    closed_by uuid REFERENCES profiles(id),
    total_amount numeric(10,2) NOT NULL DEFAULT 0.00,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE session_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES table_sessions(id),
    device_fingerprint text NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES table_sessions(id),
    status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'preparing', 'ready', 'delivered', 'cancelled')),
    estimated_wait_minutes integer,
    rating integer CHECK (rating BETWEEN 1 AND 5),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_at_order numeric(10,2) NOT NULL CHECK (price_at_order >= 0),
    item_status text NOT NULL DEFAULT 'pending' CHECK (item_status IN ('pending', 'preparing', 'ready')),
    item_started_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id uuid NOT NULL REFERENCES profiles(id),
    station text NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shift_switch_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES profiles(id),
    target_id uuid NOT NULL REFERENCES profiles(id),
    requester_shift_id uuid NOT NULL REFERENCES shifts(id),
    target_shift_id uuid NOT NULL REFERENCES shifts(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE surplus_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    discounted_price numeric(10,2) NOT NULL CHECK (discounted_price >= 0),
    pickup_window_start timestamptz NOT NULL,
    pickup_window_end timestamptz NOT NULL,
    is_claimed boolean NOT NULL DEFAULT false,
    total_given_away integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cart_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
    menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT cart_items_session_menu_item_unique UNIQUE (session_id, menu_item_id)
);