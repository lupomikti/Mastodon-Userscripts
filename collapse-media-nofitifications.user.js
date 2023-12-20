// ==UserScript==
// @name         Collapse Media in Notifications By Default
// @namespace    http://tampermonkey.net/
// @version      0.7.2
// @description  Adds a collapsible toggle to posts in your notifications for media
// @author       LupoMikti
// @license      MIT
// @match        https://baraag.net/notifications
// @icon         https://www.google.com/s2/favicons?sz=64&domain=baraag.net
// @updateURL    https://github.com/lupomikti/Mastodon-Userscripts/raw/main/collapse-media-notifications.user.js
// @downloadURL  https://github.com/lupomikti/Mastodon-Userscripts/raw/main/collapse-media-notifications.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let css = `.media-toggle {
    margin-top: 10px;
    & span {
        cursor: pointer;
    }
}

.muted .media-toggle span {
    color: #606984;
    filter: brightness(1.5);
}

.status-card.expanded .status-card__image {
    visibility: collapse;
}
`

    // This waits until we have the notifications response JSON then makes the script wait 1 second more for all DOM changes to take place
    var origOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
            // console.log('XHR finished loading', method, this.status, url);
            if (url.includes('api/v1/notifications')) {
                return setTimeout(init, 1000)
            }
        })

        this.addEventListener('error', function() {
            console.log('XHR errored out', method, url)
        })
        origOpen.apply(this, arguments)
    }

    // We cannot inject a style element without the nonce, so get it and use it
    let styleNonce = document.querySelector('meta[name=style-nonce]').content
    document.head.insertAdjacentHTML('beforeend',`<style id="notif-media-toggle-css" nonce="${styleNonce}">${css}</style>`)

    let notificationColumn

    window.addEventListener('popstate', refreshScript)

    function init() {
        notificationColumn = document.querySelector('.column[aria-label="Notifications"] .item-list')
        let initialPostsWithMedia = document.querySelectorAll(`.item-list article[style=""] .notification .status > .media-gallery,
            .item-list article[style=""] .notification .status > .media-gallery__item,
            .item-list article:not(article[style]) .notification .status > .media-gallery,
            .item-list article:not(article[style]) .notification .status > .media-gallery__item`)

        initialPostsWithMedia.forEach((mediaSection) => {insertToggle(mediaSection)})

        let insertedToggles = document.querySelectorAll('.media-toggle')

        for (let toggle of insertedToggles) {
            toggle.addEventListener('click', doToggle)
        }

        startObserving()
    }

    function refreshScript() {
        return setTimeout(init, 500)
    }

    // Inserts the toggle span into a post
    function insertToggle(mediaSection, parentArticleId = null, wasKeptOpen = 'false') {
        if (!mediaSection) return
        if (mediaSection.parentNode.querySelector('.media-toggle')) return
        const showingMedia = (wasKeptOpen === 'true')
        if (!parentArticleId) {
            parentArticleId = mediaSection.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.getAttribute('data-id') // yeah not the best line of code I've written
        }
        mediaSection.insertAdjacentHTML('beforebegin',`<div class="media-toggle" data-toggle-target="article[data-id='${parentArticleId}'] .${mediaSection.className}"><span>Click to ${showingMedia ? 'hide' : 'show'} media</span></div>`)
        mediaSection.parentNode.querySelector('.media-toggle').addEventListener('click', doToggle)
        if (!showingMedia) mediaSection.style = mediaSection.style.cssText + " display: none;"
    }

    // Click handler for the toggle span
    function doToggle(event) {
        if(event.target.nodeName !== 'SPAN') return
        let toggle = event.currentTarget
        let toggleTargetSelector = toggle?.getAttribute('data-toggle-target')
        let parentArticleSelector = toggleTargetSelector?.replace(/ \..+/,'')
        let toggleTarget = document.querySelector(toggleTargetSelector)
        let parentArticle = document.querySelector(parentArticleSelector)
        if (toggleTarget.style.cssText.includes("display: none;")) {
            parentArticle.setAttribute('data-toggle-open', 'true')
            toggleTarget.style = toggleTarget.style.cssText.replace(" display: none;","")
            toggle.childNodes[0].innerText = "Click to hide media"
        }
        else {
            parentArticle.setAttribute('data-toggle-open', 'false')
            toggleTarget.style = toggleTarget.style.cssText + " display: none;"
            toggle.childNodes[0].innerText = "Click to show media"
        }
    }

    // Mutation observer needed because page dynamicaly hides + removes/adds post content as you scroll
    function startObserving() {
        const observeColumn = (mutationList) => {
            for (const mutation of mutationList) {
                if (mutation.type === 'attributes') {
                    if (mutation.target.nodeName !== 'ARTICLE') continue // if the target is not an article element skip
                    if (!mutation.oldValue) continue // if the target's old attribute value is empty, skip
                    if (mutation.target.style.cssText) continue // if the target article's style attribute is NOT being changed to empty, skip
                    insertToggle(mutation.target.querySelector('.notification .status > .media-gallery, .notification .status > .media-gallery__item'),
                                 mutation.target.getAttribute('data-id'),
                                 mutation.target.getAttribute('data-toggle-open') || 'false')
                    // continue
                }

                // for logging
//                 if (mutation.type === 'childList') {
//                     if (mutation.addedNodes.length > 0) {
//                         console.log(`== Added Nodes ==`)
//                         console.log(mutation.addedNodes)
//                         console.log(`== End Nodes ==`)
//                     }

//                     if (mutation.removedNodes.length > 0) {
//                         console.log(`== Removed Nodes ==`)
//                         console.log(mutation.removedNodes)
//                         console.log(`== End Nodes ==`)
//                     }
//                     continue
//                 }
            }
        }

        const observer = new MutationObserver(observeColumn)
        observer.observe(notificationColumn, {
            subtree: true,
//          childList: true,
            attributeFilter: ["style"],
            attributeOldValue: true
        })
    }
})();
