const express = require("express");
const { Client } = require('pg')
const { Kafka } = require('kafkajs')

const kafka = new Kafka({
    clientId: 'orders-app',
    brokers: ['broker:29092'],
})
const producer = kafka.producer()

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres"
})

const status = {
    PENDING: "PENDING",
}

async function connect_db() {
    await client.connect()
    const res = await client.query('SELECT $1::text as message', ['postgres connected!'])
    console.log(res.rows[0].message) // postgres connected!
}

const PORT = process.env.APP_PORT

app.get("/orders", async (req, res) => {
    const result = await client.query("SELECT * from public.orders");
    res.json(result.rows)
});

const consumer = kafka.consumer({ groupId: 'test-group' });
app.get("/events", async (req, res) => {
    let events = [];
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            events.push({
                partition,
                offset: message.offset,
                value: message.value.toString(),
            });
        },
    })
    res.json(events)
});

app.post("/orders", async (req, res) => {
    const result = await client.query("INSERT INTO public.orders(status) values($1) RETURNING *", [status.PENDING]);
    const order = result.rows[0];
    for (const product of req.body.products) {
        await client.query("INSERT INTO public.orders_products(order_id,product_id,qty,provided_qty) values($1,$2,$3,0)", [order.id, product.product_id, product.qty]);
    }
    // publish product OrderCreated 
    // {order_id, products[{id, qty}]}
    let payload = Buffer.from(JSON.stringify({
        type: "ORDER_CREATED",
        payload: {
            orderId: order.id,
            products: req.body.products
        }
    }));

    try {
        await producer.send({
            topic: 'orders',
            messages: [
                { value: payload },
            ],
        })
    } catch (error) {
        console.error(error);
    }
    res.json({
        ...order,
        products: req.body.products
    })
});

app.use((err, req, res) => {
    res.json(err.message);
});

async function init() {
    await connect_db()
    await producer.connect()
    // Consuming
    await consumer.connect()
    await consumer.subscribe({ topic: 'orders', fromBeginning: true })
    app.listen(PORT, () => console.log(`App on port: ${PORT}`))
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log({
                partition,
                offset: message.offset,
                value: message.value.toString(),
            })
        },
    })
}

init();