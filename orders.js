const express = require("express");
const { Client } = require('pg')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const status = {
    PENDING: "PENDING",
}

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres"
})

async function connect() {
    await client.connect()
    const res = await client.query('SELECT $1::text as message', ['postgres connected!'])
    console.log(res.rows[0].message) // postgres connected!
}

const PORT = process.env.APP_PORT

app.get("/orders", async (req, res) => {
    const result = await client.query("SELECT * from public.orders");
    res.json(result.rows)
});

app.post("/orders", async (req, res) => {
    const result = await client.query("INSERT INTO public.orders(status) values($1) RETURNING *", [status.PENDING]);
    const order = result.rows[0];
    for (const product of req.body.products) {
        await client.query("INSERT INTO public.orders_products(order_id,product_id,qty,provided_qty) values($1,$2,$3,0)", [order.id, product.product_id, product.qty]);
    }
    // publish product OrderCreated 
    // {order_id, products[{id, qty}]}
    res.json({
        ...order,
        products: req.body.products
    })
});

app.use((err, req, res) => {
    res.json(err.message);
});

connect()
app.listen(PORT, () => console.log(`App on port: ${PORT}`))