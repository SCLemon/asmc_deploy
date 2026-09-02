
// 暫存資料夾
const tmpDirMap = {
  win32: 'D:/asmc_database/tmp/',
  darwin: '/Volumes/asmc_database/tmp/'
};
const tmpDir = tmpDirMap[process.platform] || '/mnt/asmc_database/tmp/';

// 本地資料夾
const baseDirMap = {
  win32: 'D:/asmc_database/local/',
  darwin: '/Volumes/asmc_database/local/'
};
const baseDir = baseDirMap[process.platform] || '/mnt/asmc_database/local/';

module.exports = {
    tmpDir, baseDir
}
