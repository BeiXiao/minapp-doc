require([
    'gitbook',
    'jquery'
], function(gitbook, $) {
    var MAX_RESULTS = 15;
    var MAX_DESCRIPTION_SIZE = 200;

    var usePushState = (typeof history.pushState !== 'undefined');

    // DOM Elements
    var $body = $('body');
    var $bookSearchResults;
    var $searchInput;
    var $searchList;
    var $searchTitle;
    var $searchResultsCount;
    var $searchQuery;
    var $textNode;
    // Throttle search
    function throttle(fn, wait) {
        var timeout;

        return function() {
            var ctx = this, args = arguments;
            if (!timeout) {
                timeout = setTimeout(function() {
                    timeout = null;
                    fn.apply(ctx, args);
                }, wait);
            }
        };
    }

    window.jump = function(offsetTop) {
        $('#book-search-results').removeClass('open')

        $(".body-inner").animate({
            scrollTop: offsetTop
        }, 300);
    }

    function searchInCurrentPage(q) {
        if (!$textNode){
            $textNode = $('.markdown-section').find('div,p,h3').filter(function() {
                return  $.trim($(this).text())
            })

            $textNode = $.map($textNode, function(dom) {
                var $dom = $(dom)
                var text = $(dom).text()
                var top = dom.getBoundingClientRect().top
                return {
                    'type': 'self',
                    'offsetTop': top,
                    'body': text
                }
            })
        }

        let start = Date.now()
        var results = $textNode.filter(function(item) {
            if (item.body.indexOf(q) >= 0) {
                item.title = q
                return item
            }
        })
        return results
    }

    function displayResults(res) {
        $bookSearchResults.addClass('open');

        var noResults = res.count == 0;
        $bookSearchResults.toggleClass('no-results', noResults);

        // Clear old results
        $searchList.html('');

        // Display title for research
        $searchResultsCount.text(res.count);
        $searchQuery.text(res.query);

        // Create an <li> element for each result
        var html = ''
        for (var i = 0 ; i < res.results.length ; i++) {
            var obj = res.results[i]

            var template = '<li class="search-results-item"><h3>{#link#}</h3><p>{#body#}</p></li>'
            
            var $link = ''
            var $body = ''
            var content = obj.body.trim();
            if (content.length > MAX_DESCRIPTION_SIZE) {
                content = content.slice(0, MAX_DESCRIPTION_SIZE).trim()+'...';
            }
            $body = '<p>' + content + '</p>'

            if (obj.type === 'self') {
                $link = '<a href="javascript:;" type="self" onclick="jump('+ obj.offsetTop + ')">' + obj.title + "</a>"
            } else {
                $link = '<a href="' + gitbook.state.basePath + '/' + obj.url + '">' + obj.title + "</a>"
            }
            html += template.replace('{#link#}', $link).replace('{#body#}', $body)
        }
        $('.search-results-list').append(html)
    }

    function launchSearch(q) {
        // Add class for loading
        $body.addClass('with-search');
        $body.addClass('search-loading');

        // Launch search query
        throttle(gitbook.search.query(q, 0, MAX_RESULTS)
        .then(function(results) {
            var currentPageResult = searchInCurrentPage(q) || []
            results.results = currentPageResult.slice(0, MAX_RESULTS).concat(results.results)
            results.count = results.results.length
            displayResults(results)
        })
        .always(function() {
            $body.removeClass('search-loading');
        }), 1000);
    }

    function closeSearch() {
        $body.removeClass('with-search');
        $bookSearchResults.removeClass('open');
    }

    function launchSearchFromQueryString() {
        var q = getParameterByName('search-input');
        if (q && q.length > 0) {
            // Update search input
            $searchInput.val(q);

            // Launch search
            launchSearch(q);
        }
    }

    function bindSearch() {
        // Bind DOM
        $searchInput        = $('#search-input');
        $bookSearchResults  = $('#book-search-results');
        $searchList         = $bookSearchResults.find('.search-results-list');
        $searchTitle        = $bookSearchResults.find('.search-results-title');
        $searchResultsCount = $searchTitle.find('.search-results-count');
        $searchQuery        = $searchTitle.find('.search-query');

        // Launch query based on input content
        function handleUpdate() {
            var q = $searchInput.val();
            if (q.length == 0) {
                closeSearch();
            }
            else {
                launchSearch(q);
            }
        }

        // Detect true content change in search input
        // Workaround for IE < 9
        var propertyChangeUnbound = false;
        // $(document).on("propertychange", "#search-input" , function(e){
        $searchInput.off('propertychange').on('propertychange', function(e) {
            if (e.originalEvent.propertyName == 'value') {
                handleUpdate();
            }
        });

        // HTML5 (IE9 & others)
        // $(document).on("input", "#search-input" , function(e){
        $searchInput.off('input').on('input', function(e) {
            // Unbind propertychange event for IE9+
            if (!propertyChangeUnbound) {
                $(this).unbind('propertychange');
                propertyChangeUnbound = true;
            }
            handleUpdate();
        });

        // Push to history on blur
        $searchInput.off('blur').on('blur', function(e) {
        // $(document).on("blur", "#search-input" , function(e){
            // Update history state
            if (usePushState) {
                var uri = updateQueryString('search-input', $(this).val());
                history.pushState({ path: uri }, null, uri);
            }
        });
    }

    document.addEventListener('page.change', function() {
        $textNode = null;
        bindSearch();
        closeSearch();
    })

    gitbook.events.on('page.change', function() {
        bindSearch();
        closeSearch();
        // Launch search based on query parameter
        if (gitbook.search.isInitialized()) {
            launchSearchFromQueryString();
        }
    });

    gitbook.events.on('search.ready', function() {
        bindSearch();

        // Launch search from query param at start
        launchSearchFromQueryString();
    });

    function getParameterByName(name) {
        var search = window.location.search.replace('?', '')
        var arr = search.split('&')
        var json = {}
        for(var i = 0, l = arr.length; i < l; i++){
            var temp = arr[i].split("=");
            json[temp[0]] = temp[1];
        }
        return json[name]
    }


    function updateQueryString(key, value) {
        value = encodeURIComponent(value);

        var url = window.location.href;
        var re = new RegExp('([?&])' + key + '=.*?(&|#|$)(.*)', 'gi'),
            hash;

        if (re.test(url)) {
            if (typeof value !== 'undefined' && value !== null)
                return url.replace(re, '$1' + key + '=' + value + '$2$3');
            else {
                hash = url.split('#');
                url = hash[0].replace(re, '$1$3').replace(/(&|\?)$/, '');
                if (typeof hash[1] !== 'undefined' && hash[1] !== null)
                    url += '#' + hash[1];
                return url;
            }
        }
        else {
            if (typeof value !== 'undefined' && value !== null) {
                var separator = url.indexOf('?') !== -1 ? '&' : '?';
                hash = url.split('#');
                url = hash[0] + separator + key + '=' + value;
                if (typeof hash[1] !== 'undefined' && hash[1] !== null)
                    url += '#' + hash[1];
                return url;
            }
            else
                return url;
        }
    }
});
