CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table if not exists products(
	id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
	createdAt TIMESTAMP default CURRENT_TIMESTAMP NOT NULL,
	qty integer,
	name varchar(100) not null,
);