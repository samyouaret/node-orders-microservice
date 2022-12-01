CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
create table if not exists orders(
	id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
	createdAt TIMESTAMP default CURRENT_TIMESTAMP NOT NULL,
	updatedAt TIMESTAMP default CURRENT_TIMESTAMP NOT NULL,	
	status varchar(80)
);

create table if not exists products(
	id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
	createdAt TIMESTAMP default CURRENT_TIMESTAMP NOT NULL,
	name varchar(100) not null
);

create table if not exists orders_products(
	order_id uuid,
	product_id uuid,
	qty integer,
	foreign key (order_id) references orders(id),
	foreign key (product_id) references products(id),
    provided_qty integer
);