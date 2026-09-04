const axios = require('axios')
const cheerio = require('cheerio');

const key = 'U3VwZXJBZG06NzIxNTY4'

const system = {
    '001': {
        label:'R212-1',
        ip: 'http://192.168.0.5',
    },
    '002': {
        label:'R212-2',
        ip: 'http://192.168.0.2',
    },
    '003': {
        label:'R108',
        ip: 'http://192.168.0.3',
    },
    '004': {
        label:'R209',
        ip: 'http://192.168.0.4',
    }
}

async function wakeup(systemId) {

    try {

        await axios.get(
            `${system[systemId].ip}/userlist.htm`,
            {
                headers: {
                    Authorization: `Basic ${key}`
                },
                timeout: 5000
            }
        );
        
        return true;

    } 
    catch (e) {
        console.log(`System ${systemId} Offline`);
        return false;
    }

}


// 新增 or 修改使用者 -- ok
async function addUser(systemId, uAddr, uName, uid1, uid2) {

    const online = await wakeup(systemId);

    if (!online) {
        return {
            message: `${systemId} 門禁系統斷線。`, data: [] ,type: 'error'
        }
    }

    const data = {
        uAddr,
        uName: uName,
        uMode: 'Card Only',
        uPIN: 0,
        uUIDsite: uid1,
        uUIDcard: uid2,
        cGate0: 'on',
        uZone0: 0,
        cGate1: 'on',
        uZone1: 0,
        uLevel: 0,
        uDayBegin: '20-02-05',
        uDayEnd: '79-12-31',
        formvalue: '4d1ee2d7fa1869fa'
    }

    try {
        const res = await axios.post(`${system[systemId].ip}/UserParam.cgi`,
            new URLSearchParams(data).toString(),
            {  
                headers: {
                    Authorization: `Basic ${key}`
                },
            }
        );
        return {
            message: '門禁用戶新增/修改成功。',
            type: 'success'
        };

    } 
    catch (e) {
        console.log(e);
        return {
            message: '門禁用戶新增/修改失敗。',
            type: 'error'
        };
    }

}

// 刪除使用者
async function deleteUser(systemId, uAddr) {

    const online = await wakeup(systemId);

    if (!online) {
        return {
            message: `${systemId} 門禁系統斷線。`, data: [] ,type: 'error'
        }
    }

    const data = {
        uAddr,
        uName: '',
        uMode: 'Invalid',
        uPIN: 0,
        uUIDsite: '65535',
        uUIDcard: '65535',
        cGate0: 'on',
        uZone0: 0,
        cGate1: 'on',
        uZone1: 0,
        uLevel: 0,
        uDayBegin: '20-02-05',
        uDayEnd: '79-12-31',
        formvalue: '4d1ee2d7fa1869fa'
    }

    try {
        const res = await axios.post(`${system[systemId].ip}/UserParam.cgi`,
            new URLSearchParams(data).toString(),
            {
                headers: {
                    Authorization: `Basic ${key}`
                },
            }
        );
        return {
            message: '門禁用戶刪除成功。',
            type: 'success'
        };

    } 
    catch (e) {

        console.log(e);

        return {
            message: '門禁用戶刪除失敗。',
            type: 'error'
        };
    }

}

// 獲取使用者列表 -- ok
async function getUserList(systemId, uAddr) {

    const online = await wakeup(systemId);

    if (!online) {
        return {
            message: `${systemId} 門禁系統斷線。`, data: [] ,type: 'error'
        }
    }

    try {

        const getPage = async () => {

            const res = await axios.post(
                `${system[systemId].ip}/UserList.cgi`,

                new URLSearchParams({
                    uAddr: uAddr,
                    btnNext: '>>',
                    formvalue: ''
                }),

                {
                    headers: {
                        Authorization: `Basic ${key}`,
                    },
                }
            );

            const $ = cheerio.load(res.data);

            const users = [];

            $('table').eq(1).find('tr').each((index, element) => {

                if (index === 0) return;

                const td = $(element).find('td');

                if (td.length === 0) return;

                const address = Number($(td[0]).text().trim());

                if (isNaN(address)) return;

                users.push({
                    address,
                    name: $(td[1]).text().trim(),
                    accessMode: $(td[2]).text().trim(),
                    cardUID: $(td[3]).text().trim(),
                    ma: $(td[4]).text().trim(),
                    zone: $(td[5]).text().trim(),
                    wg: $(td[6]).text().trim(),
                    wgZone: $(td[7]).text().trim(),
                    expiry: $(td[8]).text().trim()
                });

            });
            return users;

        };

        const users1 = await getPage();

        // 延遲
        await new Promise(resolve => setTimeout(resolve, 300));

        const users2 = await getPage();


        // 合併
        const users = [
            ...users1,
            ...users2
        ];

        // 依 Address 排序
        users.sort((a, b) => {
            return a.address - b.address;
        });

        return {
            message: `門禁用戶列表獲取成功。`,
            data: users,
            type: 'success'
        };

    } 
    catch (e) {

        console.log(e);

        return {
            message: '門禁用戶列表獲取失敗。',
            data: [],
            type: 'error'
        };

    }

}

// 獲取門禁事件列表
async function getEventLog(systemId, page) {

    const online = await wakeup(systemId);

    if (!online) {
        return {
            message: `${systemId} 門禁系統斷線。`,
            data: [],
            type: 'error'
        };
    }

    try {

        // page 至少為 1
        page = Math.max(1, Number(page) || 1);

        // 取得 EventLog 頁面
        const response = await axios.get(`${system[systemId].ip}/EventLog.htm`,
            {
                headers: {
                    Authorization: `Basic ${key}`
                }
            }
        );


        const $ = cheerio.load(response.data);

        // 取得 eTotal
        const eTotal = Number($('[name="eTotal"]').val());

        // 每頁 15 筆
        const pageSize = 15;
        const maxPage = Math.ceil(eTotal / pageSize);
        page = Math.min(page, maxPage);

        // 計算 eStart
        const eStart = Math.max(0, eTotal - (page * pageSize));

        // 取得 formvalue
        const formvalue = $('[name="formvalue"]').val();

        // POST EventLog
        const result = await axios.post(`${system[systemId].ip}/EventLog.cgi`,

            new URLSearchParams({
                eStart: String(eStart),
                btnLoad: 'Go to',
                eTotal: String(eTotal),
                formvalue
            }),

            {
                headers: {
                    Authorization: `Basic ${key}`,
                }
            }
        );


        const $$ = cheerio.load(result.data);

        const eventTable = $$('table').eq(1);

        if (!eventTable.length) {
            return {
                message: '找不到 Event Log 資料。',
                data: [],
                type: 'error'
            };
        }

        const data = [];

        // 第一列是 Header，所以跳過
        eventTable.find('tr').slice(1).each((_, row) => {

            const cells = $$(row).find('td');

            if (cells.length < 8) return;

            data.push({
                index: $$(cells[0]).text().trim(),
                date: $$(cells[1]).text().trim(),
                time: $$(cells[2]).text().trim(),
                address: $$(cells[3]).text().trim(),
                display: $$(cells[4]).text().trim(),
                accessDetail: $$(cells[5]).text().trim(),
                cardUID: $$(cells[6]).text().trim(),
                door: $$(cells[7]).text().trim()
            });

        });

        return {
            message: '取得 Event Log 成功。',
            data,
            pagination: {
                page,
                pageSize,
                total: eTotal,
                maxPage,
                eStart
            },
            type: 'success'
        };

    } catch (e) {

        console.log(e);

        return {
            message: '取得 Event Log 失敗。',
            data: [],
            type: 'error'
        };

    }

}


module.exports = {
    addUser, deleteUser, getUserList, getEventLog, system
}


