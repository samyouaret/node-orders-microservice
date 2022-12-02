const { Client } = require('pg')
const { Kafka } = require('kafkajs')

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres"
})


async function connect_db() {
    await client.connect()
    const res = await client.query('SELECT $1::text as message', ['postgres consumer connected!'])
    console.log(res.rows[0].message) // postgres connected!
}

const kafka = new Kafka({
    clientId: 'orders-app',
    brokers: ['broker:29092'],
})
// const producer = kafka.producer()

const consumer = kafka.consumer({ groupId: 'order-group' });

async function init() {
    await connect_db();
    await consumer.connect();
    // await producer.connect();
    await consumer.subscribe({ topic: 'products', fromBeginning: true });
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            if (event.type == 'PRODUCT_CREATED') {
                const result = await client.query("INSERT INTO public.products(id,name) values($1,$2) RETURNING *", [event.payload.id, event.payload.name]);
                const product = result.rows[0];
                console.log("inserted new product...");
                console.log(product);
            }
            if (event.type == 'PRODUCT_QTY_REQUEST') {
                for (const product_qty of event.payload.products) {
                    console.log(product_qty);
                    const result = await client.query("UPDATE public.orders_products SET provided_qty=$1 where order_id=$2 AND product_id=$3", [product_qty.provided_qty, event.payload.orderId, product_qty.product_id]);
                    console.log(result);
                }
                await client.query("UPDATE public.orders SET status='READY' where id=$1", [event.payload.orderId]);
                console.log("Update qty...");
            }
        },
    });
}

init();