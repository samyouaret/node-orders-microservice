const express = require("express");
const { Client } = require('pg')
const { Kafka } = require('kafkajs')
const { Worker } = require('worker_threads');

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

app.post("/orders", async (req, res) => {
    const result = await client.query("INSERT INTO public.orders(status) values($1) RETURNING *", [status.PENDING]);
    const order = result.rows[0];
    client.query("BEGIN")
    for (const product of req.body.products) {
        await client.query("INSERT INTO public.orders_products(order_id,product_id,qty,provided_qty) values($1,$2,$3,0)", [order.id, product.product_id, product.qty]);
    }
    // publish product OrderCreated 
    let event = {
        type: "ORDER_CREATED",
        payload: {
            orderId: order.id,
            products: req.body.products
        }
    };
    await client.query("INSERT INTO public.outbox(event_type,event_payload,dispatched) values($1,$2,$3)", [event.type, event, false]);
    client.query("COMMIT");
    res.json({
        ...order,
        products: req.body.products
    })
});

app.use((err, req, res) => {
    res.json(err.message);
});

function runConsumer() {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./order-consumer.js');
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`));
        })
    })
}

async function init() {
    await connect_db()
    await producer.connect()
    setInterval(polling_publisher, 1000 * 30);
    app.listen(PORT, () => console.log(`App on port: ${PORT}`))
    await runConsumer();
}

async function polling_publisher() {
    console.log("======Polling publisher Started=======");
    const result = await client.query("SELECT * from public.outbox WHERE dispatched=$1", [false]);
    if (result.rowCount > 0) {
        const new_events = result.rows;
        console.log(new_events);
        for (const event of new_events) {
            client.query("BEGIN");
            await client.query("UPDATE public.outbox SET dispatched=$1 where id=$2", [true, event.id]);
            console.log(JSON.stringify(event));
            try {
                await producer.send({
                    topic: 'orders',
                    messages: [
                        { value: Buffer.from(JSON.stringify(event.event_payload)) },
                    ],
                })
                client.query("COMMIT");
            } catch (error) {
                console.error(error);
                client.query("ROLLBACK");
            }
        }
    } else {
        console.log("Polling publisher: No event to dispatch");
    }

}

init();