let totalLikesCount = 0;
let likesLimit = 0;
let setupTabs:chrome.tabs.Tab[] = []
// -------------------------------------------------
// ------------------Some Functions-----------------
// -------------------------------------------------

function stopAllLikeTasksLoops():Promise<Boolean> {
    return new Promise(async (resolve, reject) => {
        const manifest = chrome.runtime.getManifest();
        if (manifest.content_scripts && manifest.content_scripts[0].matches.length > 0) {
            const urlPatterns = manifest.content_scripts[0].matches;
            // Query for tabs matching these URL patterns
            let tabs = await chrome.tabs.query({ url: urlPatterns });
            let success = false
            for (let tab of tabs) {
                if (!tab.id) return;
                let status1 = null
                try {
                    let {status} = await chrome.tabs.sendMessage(tab.id, {
                        type: "action",
                        title: "Stop Likes Task",
                    });
                    status1= status
                }catch(error){
                    console.error("Tab is probably Inactive and Chached :- " + tab.url)
                }
                success = status1 || success
            }
            if (success) resolve(success)
            else reject(success)
        }
    })
}

async function startLiking_currPage(
    maxTime: number,
    minTime: number
) {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return
    chrome.tabs.sendMessage(tab.id, {
        type: "action",
        title: "Start Liking",
        maxTime: maxTime,
        minTime: minTime
    });
}

// -------------------------------------------------
// -------------Main Event Listner------------------
// -------------------------------------------------

chrome.runtime.onMessage.addListener(({ type, title, ...data }, _, sendResponse) => {
    switch (type) {
        case "action":
            switch (title) {
                case "Start Liking":
                    startLiking_currPage(
                        data.maxTime,
                        data.minTime,
                    );
                    break;
                case "Stop Liking":
                    (async () => {
                        try {
                            let status = await stopAllLikeTasksLoops();
                            sendResponse({ status: status });
                        } catch (error) {
                            sendResponse({ status: false });    
                        }
                    })()
                    return true
                    break;
            }
            break;
        case "data":
            switch (title) {
                case "Did a like":
                    totalLikesCount++;
                    chrome.runtime.sendMessage({
                        type: "data",
                        title: "Like Count",
                        data: totalLikesCount,
                    });
                    // Store total likes count
                    chrome.storage.sync.set({
                        likesCount: {
                            value: totalLikesCount,
                            timestamp: Date.now(),
                        },
                    });

                    if (totalLikesCount >= likesLimit) {
                        stopAllLikeTasksLoops();
                        chrome.runtime.sendMessage({ type: "info", title: "Target Like Reached" });
                    }
                    break;
                case "give me likes count":
                    (async () => {
                        try {
                            let res = await chrome.storage.sync.get(["likesCount"]);
                            if (!res.likesCount || res.likesCount.value === undefined) {
                                totalLikesCount = 0

                            }else{
                                const now = new Date();
                                const yesterday10PM = new Date(now);
                                yesterday10PM.setDate(now.getDate() - 1);
                                yesterday10PM.setHours(22, 0, 0, 0);
                                const today10PM = new Date(now);
                                today10PM.setHours(22, 0, 0, 0);

                                if (
                                    (today10PM.getTime() <= now.getTime() && res.likesCount.timestamp > today10PM.getTime()) || //If todays 10 Pm is Happened and Last Like was done after todays 10pm
                                    (today10PM.getTime() > now.getTime() && res.likesCount.timestamp > yesterday10PM.getTime()) //If not todays 10 Pm is Happened and Last Like was done after yesterdays 10pm
                                ) {
                                    totalLikesCount = res.likesCount.value;
                                }else{
                                    totalLikesCount = 0
                                }
                            };
                            sendResponse({ likes: totalLikesCount });
                        } catch (error) {
                            console.error(error);
                            sendResponse({ failed: true})
                        }
                    })();
                    return true;
                    break;

                case "Updated Likes Limit":
                    likesLimit = data.likesLimit
                    chrome.storage.sync.set({
                        likesLimit: {
                            value: likesLimit
                        },
                    });
                    break;
                    
                case "give me likes limit":
                    (async () => {
                        try {
                            let res = await chrome.storage.sync.get(["likesLimit"]);
                            likesLimit = res.likesLimit.value;
                            sendResponse({likesLimit: likesLimit});
                        } catch (error) {
                            sendResponse({ failed: true})
                            likesLimit = data.default
                        }
                    })();
                    return true;
                    break;
            }
            break;
    }
});
