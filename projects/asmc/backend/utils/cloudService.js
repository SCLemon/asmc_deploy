const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const cloudModel = require('../models/cloudModel');

async function createFolder({ name, parent = null, owner, token = null }) {
    if (!name) {
        return { success: false, message: '資料夾名稱不可為空。' };
    }

    // 檢查父資料夾
    if (parent) {
        const parentFolder = await cloudModel.findOne({ token: parent, type: 'folder' });
        if (!parentFolder) {
            return { success: false, message: '上層資料夾不存在。' };
        }
    }

    // 檢查同一層是否重名
    const existingFolder = await cloudModel.findOne({
        parent: parent || null,
        name,
        type: 'folder'
    });

    if (existingFolder) {
        return { success: false, message: '資料夾已存在。' };
    }

    const folder = new cloudModel({
        token: token || uuidv4(),
        name,
        type: 'folder',
        parent: parent || null,
        owner,
        createTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    });

    await folder.save();

    return {
        success: true,
        data: folder,
        message: '資料夾建立成功。'
    };
}

/**
 * 遞迴取得指定 parent 底下的所有子、孫項目
 * @param {string} parentToken
 * @returns {Promise<Array>}
 */
async function getChildrenRecursively(parentToken) {
    const children = await cloudModel.find({ parent: parentToken }).lean();
    let items = [];

    for (const child of children) {
        items.push(child);
        if (child.type === 'folder') {
            const grandChildren = await getChildrenRecursively(child.token);
            items.push(...grandChildren);
        }
    }

    return items;
}

async function deleteCloudItem(targetToken, ownerToken) {
    if (!targetToken) {
        return { success: false, message: '資料不可為空。' };
    }

    const cloud = await cloudModel.findOne({ token: targetToken, owner: ownerToken });
    if (!cloud) {
        return { success: false, message: '檔案或資料夾不存在或無權限刪除。' };
    }

    let deleteItems = [cloud];

    // 如果是資料夾，連同所有子項目一起收集
    if (cloud.type === 'folder') {
        const children = await getChildrenRecursively(targetToken);
        deleteItems.push(...children);
    }

    // 收集實體檔案路徑
    const filePaths = deleteItems
        .filter((item) => item.type === 'file' && item.file?.path)
        .map((item) => item.file.path);

    // 刪除 MongoDB 資料
    await cloudModel.deleteMany({
        token: {
            $in: deleteItems.map((item) => item.token)
        }
    });

    // 刪除本地實體檔案
    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                await fs.promises.unlink(filePath);
            } catch (e) {
                if (e.code !== 'ENOENT') {
                    console.log(`檔案刪除失敗：${filePath}`, e);
                }
            }
        })
    );

    return { success: true, message: '刪除成功。' };
}

module.exports = {
    createFolder,
    deleteCloudItem
};