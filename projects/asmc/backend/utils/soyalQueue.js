const queue = [];

let running = false;


const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};


async function processQueue() {

    // 已經有 Queue 在執行
    if (running) return;

    running = true;

    while (queue.length > 0) {

        const task = queue.shift();

        try {

            const result = await task.fn();

            task.resolve(result);

        }
        catch (error) {

            task.reject(error);

        }

        // 每個完整操作之間間隔
        await delay(500);

    }

    running = false;

}


function addToQueue(fn) {

    return new Promise((resolve, reject) => {

        queue.push({
            fn,
            resolve,
            reject
        });

        processQueue();

    });

}


module.exports = {
    addToQueue
};