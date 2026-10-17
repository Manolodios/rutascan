-- RutaScan - esquema Postgres de Supabase (proyecto hkdustypbnkycrcctctg)
-- ---------------------------------------------------------------------------
-- Generado con SQLAlchemy desde los modelos de backend/app/models y aplicado
-- en Supabase como la migracion `rutascan_initial_schema`.
--
-- Reproducir desde cero (no hace falta normalmente: la app crea el esquema
-- sola con `python -m scripts.init_db`, esto es solo el registro exacto):
--     python tools/_dump_ddl.py   (requiere PYTHONPATH=backend)
--
-- Tambien se aplico la migracion `rutascan_revoke_public_api_grants`, que
-- cierra el acceso de los roles `anon`/`authenticated` (los que usa la API
-- publica de Supabase) a estas tablas: solo la aplicacion (rol `postgres`,
-- dueno de las tablas) puede leerlas o escribirlas.

CREATE TABLE companies (
	name VARCHAR(200) NOT NULL,
	tax_id VARCHAR(50) NOT NULL,
	license_key VARCHAR(64) NOT NULL,
	subscription_status VARCHAR(32) NOT NULL,
	expiration_date DATE NOT NULL,
	max_trucks INTEGER NOT NULL,
	is_active BOOLEAN NOT NULL,
	id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (tax_id)
);
CREATE UNIQUE INDEX ix_companies_license_key ON companies (license_key);
CREATE TABLE products (
	barcode_qr VARCHAR(255) NOT NULL,
	description VARCHAR(300) NOT NULL,
	unit VARCHAR(20) NOT NULL,
	weight NUMERIC(10, 3) NOT NULL,
	is_active BOOLEAN NOT NULL,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_products_barcode_per_company UNIQUE (company_id, barcode_qr),
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_products_barcode_qr ON products (barcode_qr);
CREATE INDEX ix_products_company_id ON products (company_id);
CREATE TABLE users (
	user_cedula VARCHAR(32) NOT NULL,
	pin_hash VARCHAR(128) NOT NULL,
	full_name VARCHAR(200) NOT NULL,
	role VARCHAR(32) NOT NULL,
	is_active BOOLEAN NOT NULL,
	last_login_at TIMESTAMP WITH TIME ZONE,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_users_cedula UNIQUE (user_cedula),
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_users_company_id ON users (company_id);
CREATE INDEX ix_users_user_cedula ON users (user_cedula);
CREATE INDEX ix_users_role ON users (role);
CREATE TABLE sync_batches (
	user_id UUID NOT NULL,
	device_uuid VARCHAR(64) NOT NULL,
	received_count INTEGER NOT NULL,
	accepted_count INTEGER NOT NULL,
	rejected_count INTEGER NOT NULL,
	duplicate_count INTEGER NOT NULL,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_sync_batches_device_uuid ON sync_batches (device_uuid);
CREATE INDEX ix_sync_batches_company_id ON sync_batches (company_id);
CREATE TABLE devices (
	device_uuid VARCHAR(64) NOT NULL,
	user_id UUID,
	platform VARCHAR(32),
	app_version VARCHAR(32),
	first_seen_at TIMESTAMP WITH TIME ZONE,
	last_seen_at TIMESTAMP WITH TIME ZONE,
	is_active BOOLEAN NOT NULL,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_devices_uuid_per_company UNIQUE (company_id, device_uuid),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_devices_company_id ON devices (company_id);
CREATE INDEX ix_devices_last_seen_at ON devices (last_seen_at);
CREATE INDEX ix_devices_device_uuid ON devices (device_uuid);
CREATE TABLE security_events (
	event_type VARCHAR(32) NOT NULL,
	user_id UUID,
	device_uuid VARCHAR(64),
	latitude FLOAT,
	longitude FLOAT,
	detail JSONB,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_security_events_company_id ON security_events (company_id);
CREATE INDEX ix_security_events_event_type ON security_events (event_type);
CREATE INDEX ix_security_events_device_uuid ON security_events (device_uuid);
CREATE TABLE trucks (
	license_plate VARCHAR(20) NOT NULL,
	model VARCHAR(100),
	assigned_driver_id UUID,
	is_active BOOLEAN NOT NULL,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_trucks_plate_per_company UNIQUE (company_id, license_plate),
	FOREIGN KEY(assigned_driver_id) REFERENCES users (id) ON DELETE SET NULL,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_trucks_assigned_driver_id ON trucks (assigned_driver_id);
CREATE INDEX ix_trucks_company_id ON trucks (company_id);
CREATE INDEX ix_trucks_license_plate ON trucks (license_plate);
CREATE TABLE routes (
	truck_id UUID NOT NULL,
	route_date DATE NOT NULL,
	status VARCHAR(32) NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE,
	completed_at TIMESTAMP WITH TIME ZONE,
	notes VARCHAR(500),
	created_by_id UUID,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_routes_truck_per_date UNIQUE (truck_id, route_date),
	FOREIGN KEY(truck_id) REFERENCES trucks (id) ON DELETE CASCADE,
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_routes_status ON routes (status);
CREATE INDEX ix_routes_company_id ON routes (company_id);
CREATE INDEX ix_routes_truck_id ON routes (truck_id);
CREATE INDEX ix_routes_route_date ON routes (route_date);
CREATE TABLE route_details (
	route_id UUID NOT NULL,
	product_id UUID NOT NULL,
	assigned_quantity INTEGER NOT NULL,
	delivered_quantity INTEGER NOT NULL,
	status VARCHAR(32) NOT NULL,
	return_required BOOLEAN NOT NULL,
	rejection_reason VARCHAR(40),
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	CONSTRAINT uq_route_details_product UNIQUE (route_id, product_id),
	FOREIGN KEY(route_id) REFERENCES routes (id) ON DELETE CASCADE,
	FOREIGN KEY(product_id) REFERENCES products (id) ON DELETE RESTRICT,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_route_details_product_id ON route_details (product_id);
CREATE INDEX ix_route_details_status ON route_details (status);
CREATE INDEX ix_route_details_company_id ON route_details (company_id);
CREATE INDEX ix_route_details_route_id ON route_details (route_id);
CREATE TABLE delivery_logs (
	route_detail_id UUID NOT NULL,
	driver_id UUID NOT NULL,
	scan_uuid VARCHAR(64) NOT NULL,
	action VARCHAR(32) NOT NULL,
	quantity INTEGER NOT NULL,
	scan_timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL,
	server_timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL,
	latitude FLOAT NOT NULL,
	longitude FLOAT NOT NULL,
	gps_accuracy_m FLOAT,
	device_uuid VARCHAR(64) NOT NULL,
	is_mocked_location BOOLEAN NOT NULL,
	synced_with_server BOOLEAN NOT NULL,
	via_offline_batch BOOLEAN NOT NULL,
	flags JSONB,
	pod_signature_url VARCHAR(500),
	pod_photo_url VARCHAR(500),
	rejection_reason VARCHAR(32),
	rejection_notes VARCHAR(500),
	sync_batch_id UUID,
	id UUID NOT NULL,
	company_id UUID NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL,
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(route_detail_id) REFERENCES route_details (id) ON DELETE CASCADE,
	FOREIGN KEY(driver_id) REFERENCES users (id) ON DELETE RESTRICT,
	UNIQUE (scan_uuid),
	FOREIGN KEY(sync_batch_id) REFERENCES sync_batches (id) ON DELETE SET NULL,
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE INDEX ix_delivery_logs_company_id ON delivery_logs (company_id);
CREATE INDEX ix_delivery_logs_detail ON delivery_logs (route_detail_id, scan_timestamp_utc);
CREATE INDEX ix_delivery_logs_driver_id ON delivery_logs (driver_id);
CREATE INDEX ix_delivery_logs_driver_time ON delivery_logs (driver_id, scan_timestamp_utc);
CREATE INDEX ix_delivery_logs_route_detail_id ON delivery_logs (route_detail_id);
CREATE INDEX ix_delivery_logs_device_uuid ON delivery_logs (device_uuid);

-- ---------------------------------------------------------------------------
-- Migracion `rutascan_add_fk_indexes`: indices sobre claves foraneas que el
-- advisor de rendimiento de Supabase recomendo. El mismo cambio quedo en los
-- modelos (index=True), asi que init_db los crea tambien en cualquier base
-- nueva (local o en la nube).
CREATE INDEX IF NOT EXISTS ix_delivery_logs_sync_batch_id ON delivery_logs (sync_batch_id);
CREATE INDEX IF NOT EXISTS ix_devices_user_id ON devices (user_id);
CREATE INDEX IF NOT EXISTS ix_routes_created_by_id ON routes (created_by_id);
CREATE INDEX IF NOT EXISTS ix_security_events_user_id ON security_events (user_id);
CREATE INDEX IF NOT EXISTS ix_sync_batches_user_id ON sync_batches (user_id);
