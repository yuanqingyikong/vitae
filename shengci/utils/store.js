// 「此生」数据层 —— v0.1 使用本地存储。
// 唯一职责：读写持久化数据。页面不得直接调用 wx.setStorage。
// 后续接入云开发时，只需替换本文件的实现，页面代码不变。

const PROFILE_KEY = 'sc_profile';
const EVENTS_KEY = 'sc_events';
const DRAFT_KEY = 'sc_draft';

function read(key, fallback) {
    try {
        const v = wx.getStorageSync(key);
        if (v === '' || v === null || v === undefined) return fallback;
        return v;
    } catch (e) {
        return fallback;
    }
}

function write(key, value) {
    try {
        wx.setStorageSync(key, value);
        return true;
    } catch (e) {
        return false;
    }
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- 档案 ----------

function getProfile() {
    return read(PROFILE_KEY, null);
}

function saveProfile(profile) {
    return write(PROFILE_KEY, profile);
}

function hasBirth() {
    const p = getProfile();
    return !!(p && p.birthDate);
}

// ---------- 事件 ----------

function listEvents() {
    const list = read(EVENTS_KEY, []);
    if (!Array.isArray(list)) return [];
    // 按时间倒序；记不清的事件（sortKey = -1）沉到最底
    return list.slice().sort(function (a, b) {
        return (b.sortKey || 0) - (a.sortKey || 0);
    });
}

function getEvent(id) {
    const list = read(EVENTS_KEY, []);
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
    }
    return null;
}

function saveEvent(event) {
    const list = read(EVENTS_KEY, []);
    const now = Date.now();
    let index = -1;
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === event.id) {
            index = i;
            break;
        }
    }
    const record = Object.assign({}, event, { updatedAt: now });
    if (index >= 0) {
        record.createdAt = list[index].createdAt || now;
        list[index] = record;
    } else {
        record.createdAt = now;
        list.unshift(record);
    }
    write(EVENTS_KEY, list);
    return record;
}

function removeEvent(id) {
    const list = read(EVENTS_KEY, []).filter(function (e) {
        return e.id !== id;
    });
    write(EVENTS_KEY, list);
    return list.length;
}

// ---------- 草稿 ----------
// 录入中断时不丢内容。照片在选择时即落盘为持久路径，避免临时路径失效。

function getDraft() {
    return read(DRAFT_KEY, null);
}

function saveDraft(draft) {
    return write(DRAFT_KEY, draft);
}

function clearDraft() {
    try {
        wx.removeStorageSync(DRAFT_KEY);
    } catch (e) {
        // 忽略
    }
}

// ---------- 照片 ----------
// chooseMedia 返回的是临时路径，重启小程序即失效，必须复制到用户目录。

function persistPhoto(tempPath) {
    try {
        const fs = wx.getFileSystemManager();
        const dir = wx.env.USER_DATA_PATH + '/photos';
        try {
            fs.accessSync(dir);
        } catch (e) {
            fs.mkdirSync(dir, true);
        }
        const matched = tempPath.match(/\.([a-zA-Z0-9]+)$/);
        const ext = matched ? matched[1] : 'jpg';
        const target = dir + '/' + Date.now() + '_' + Math.floor(Math.random() * 100000) + '.' + ext;
        fs.copyFileSync(tempPath, target);
        return target;
    } catch (e) {
        // 落盘失败时退回临时路径，至少本次会话可见
        return tempPath;
    }
}

module.exports = {
    uid: uid,
    getProfile: getProfile,
    saveProfile: saveProfile,
    hasBirth: hasBirth,
    listEvents: listEvents,
    getEvent: getEvent,
    saveEvent: saveEvent,
    removeEvent: removeEvent,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    persistPhoto: persistPhoto
};
