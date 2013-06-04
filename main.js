(function($) {
	var MIN_COL_WIDTH = 250,
		MAX_COLS = 4,
		closeTiddler;

	$.getJSON('/status', function(status) {
		$('.space-name').text(status.space.name);
		document.title = status.space.name + ' - ' + document.title;
	});

	var store = tiddlyweb.Store(function(tiddlers) {
		var searchStr = decodeURIComponent(window.location.hash.slice(1));

		if (searchStr) {
			populateMosaic(search(searchStr), '-searchScore');
		} else {
			populateMosaic(store.Collection(tiddlers).find('!#excludeLists'));
		}

		populateDropdowns(tiddlers);
	});

	var makeFat = (function() {
		var isFat = false;
		return function(callback) {
			if (!isFat) {
				$.ajaxSetup({ data: { fat: 1 } });
				store.refresh(function() {
					isFat = true;
					callback.apply(this, arguments);
				});
				$.ajaxSetup({ data: {} });
			} else {
				fp.nextTick(callback);
			}
		}
	}());

	function search(str) {
		var tiddlers;

		function _textSearch(tiddlers) {
			// give each tiddler a score based on how good the match is, then
			// sort them all based on that match
			var countHash = {},
			searchTerms = str.split(/[ \/,\.]/);

			function isIn(text, match) {
				if (!text) return false;
				match = match.toLowerCase();
				text = typeof text === 'string' ? text.toLowerCase() :
					text.map(function(a) { return a.toLowerCase(); });
				return ~text.indexOf(match);
			}

			function calculateCount(tiddler) {
				var count = 0;
				searchTerms.forEach(function(search) {
					count += tiddler.title === search ? 10 : 0;
					count += isIn(tiddler.title, search) ? 5 : 0;
					count += isIn(tiddler.tags, search) ? 3 : 0;
					count += isIn(tiddler.text, search) ? 1 : 0;
				});
				return count;
			}

			return tiddlers.sort(function(a, b) {
				var aCount = countHash[a.uri],
					bCount = countHash[b.uri];
				if (aCount == null) {
					aCount = calculateCount(a);
					countHash[a.uri] = aCount;
				}
				if (bCount == null) {
					bCount = calculateCount(b);
					countHash[b.uri] = bCount;
				}
				return (a > b) ? -1 : (a < b) ? 1 : (a.modified > b.modified) ?
					-1 : (a.modified < b.modified) ? 1 : 0;
			}).filter(function(t) { return countHash[t.uri] > 0; })
				.map(function(t, i) {
					t.searchScore = countHash[t.uri];
					return t;
				});
		}

		try {
			tiddlers = store().find(str);
		} catch(e) {
			tiddlers = _textSearch(store());
		}

		return tiddlers;
	}

	function populateDropdowns(tiddlers) {
		var spaces = {}, tags = {};
		tiddlers.each(function(tid) {
			var spaceName = tid.bag.name.replace(/_[^_]*$/, '');

			tid.tags.forEach(function(tag) {
				if (!tags[tag]) {
					tags[tag] = 1;
				} else {
					tags[tag]++;
				}
			});

			if (!spaces[spaceName]) {
				spaces[spaceName] = 1;
			} else {
				spaces[spaceName]++;
			}
		});
		tags = $.map(tags, function(c, t) { return { t: t, c: c }; });
		spaces = $.map(spaces, function(c, s) { return { s: s, c: c }; });

		tags = $.map(store.fn.sort.call(tags, '-c'), function(obj) {
			return obj.t;
		}).slice(0, 20);
		spaces = $.map(store.fn.sort.call(spaces, '-c'), function(obj) {
			return obj.s;
		}).slice(0, 20);

		$('.tag-list').html(render('tagListTemplate', { tags: tags }));
		$('.space-list').html(render('spaceListTemplate', { spaces: spaces }));
	}

	var populateMosaic = (function() {
		var tiddlers = [],
			$el = $('.mosaic'),
			offset = 0,
			columns,
			max = 75;

		function insertNextTiddlers() {
			var currentCol = 0;
			columns.forEach(function(c) { c.addClass('filling'); });

			fp.nextTick(function() {
				for (var index = offset, l = offset + max; index < l; index++) {
					tiddler = tiddlers[index];
					if (!tiddler) {
						$(window).off('scroll', onScroll);
						break;
					}

					tiddler.isPrivate = /_private$/.test(tiddler.bag.name)
						? 'private' : '';
					columns[currentCol].append(render('mosaicTemplate',
							tiddler))
						.find('article:last')
						.addClass(pickColor(tiddler));
					currentCol = nextCol(currentCol, columns);
				}
				offset = index;

				var width = $('.mosaic').width() / columns.length;
				columns.forEach(function(c) {
					c.removeClass('filling');
					c.css('width', width);
				});
			});
		}

		var $doc = $(document), $mos = $('.mosaic');
		var onScroll = fp.throttle(function(ev) {
			if ($mos.css('display') != 'none') {
				if ($doc.scrollTop() >
						$doc.height() - window.innerHeight - 500) {
					insertNextTiddlers()
				}
			}
		}, 300);

		return function populateMosaic(tids, sort) {
			$el.empty();
			columns = [];
			offset = 0;
			var totalColumns = Math.floor($(window).width() / MIN_COL_WIDTH),
				i;

			totalColumns = totalColumns > MAX_COLS ? MAX_COLS : totalColumns;
			for (i = 0; i < totalColumns; i++) {
				columns[i] = $('<div/>', {
					'class': 'column'
				}).appendTo($el);
			}

			$(window).off('scroll', onScroll);
			$(window).on('scroll', onScroll);

			fp.nextTick(function() {
				tiddlers = tids;
				tiddlers = tiddlers.sort((sort ? sort + ', ' : '') + '-modified');
				insertNextTiddlers();
				window.scrollTo(0, 0);
			});
		}
	}());

	function nextCol(current, columns) {
		var smallest = current, i, l;
		for (i = 0, l = columns.length; i < l; i++) {
			if (columns[i].height() < columns[smallest].height()) {
				smallest = i;
			}
		}
		return smallest;
	}

	function render(template, tiddler) {
		return Mustache.to_html($('#' + template).html(), tiddler);
	}

	var colors = [
		'primary',
		'inverse',
		'success',
		'warning',
		'important',
		'info',
	];

	var pickColor = (function() {
		var prevColor = 0;
		return function pickColor(tiddler) {
			var color = Math.floor(Math.random() * colors.length);
			if (prevColor == color) {
				return pickColor(tiddler);
			} else {
				prevColor = color;
				return colors[color];
			}
		}
	}());

	function displayTiddler(title, context) {
		var $el = $('.tiddler-detail').empty(),
			$header = $('header .dropdown-menu  a, header .brand'),
			$search = $('header form'),
			$mosaic = $('.mosaic'),
			$back, url;

		function hideTiddler() {
			$el.removeClass('show');
			$back.off('click', hideTiddler);
			$el.off('click', '.tag', hideTiddler);
			$header.off('click', hideTiddler);
			$search.off('submit', hideTiddler);
			$mosaic.show();
			window.history.pushState({}, '', '/');
		}

		closeTiddler = hideTiddler;

		function formatType(tiddler) {
			tiddler.modified = moment(tiddler.modified).fromNow();
			tiddler.created = moment(tiddler.created)
				.format('Do MMMM YYYY, H:mm:ss');
			if (!tiddler.render) {
				if (/image/.test(tiddler.type)) {
					tiddler.render = render('tiddlerImageTemplate', tiddler);
				} else if (tiddler.type == 'text/html') {
					// render tiddler in iframe
					url = encodeURIComponent(tiddler.title);
					url = context ? url + '#' + encodeURIComponent(context)
						: url;
					tiddler.render = '<iframe src="/' + url + '"></iframe>';
				} else if (/(text|xml|json|javascript)/.test(tiddler.type)) {
					tiddler.render = render('tiddlerCodeTemplate', tiddler);
				} else {
					tiddler.render = render('tiddlerUnknownTemplate', tiddler);
				}
			} else {
				cleanUpTiddler(tiddler);
			}
		}

		function isInline(el) {
			var inlines = ['#text', 'A', 'SPAN', 'CODE', 'EM', 'STRONG'];
			return !!~inlines.indexOf(el.nodeName);
		}

		function cleanUpTiddler(tiddler) {
			if (tiddler.type == null) {
				tiddler.render = $(tiddler.render)
					.find('table').addClass('table').end()
					.find('> br').each(function(i, el) {
						var sibling = el.previousSibling,
							$para = $('<p/>');
						while(sibling) {
							if (sibling.nodeName !== 'BR'
									&& isInline(sibling)) {
								$para.prepend(sibling);
							} else {
								break;
							}
							sibling = el.previousSibling;
						}
						if ($para[0].childNodes.length) {
							$para.insertBefore(el);
						}
					}).remove().end()[0].outerHTML;
			}
		}

		store.get(title, function(tiddler) {
			if (tiddler) {
				formatType(tiddler);
				if (tiddler.type == 'text/html') {
					$el.append(tiddler.render);
				} else if (!/^<div>/.test(tiddler.render) &&
						/(text|xml|json|javascript)/.test(tiddler.type)) {
					var output = $el.append(render('tiddlerTemplate', tiddler)),
						text = output.find('section.text').html();
					output.find('section.text').html('<div>' + text + '</div>');
				} else {
					$el.append(render('tiddlerTemplate', tiddler));
				}
				$el.addClass('show');
				$back = $('.tiddler-detail .back');
				$back.on('click', hideTiddler);
				$header.on('click', hideTiddler);
				$search.on('submit', hideTiddler);
				$el.children().on('click', function(ev) {
					if (!$(ev.target).hasClass('tag')) {
						ev.stopPropagation();
					}
				});
				$el.on('click', '.tag', hideTiddler);
				var replyButton = $el.find('.reply')[0];
				if (replyButton) {
					createReplyButton($el.find('.reply')[0]);
				}
				$el.find('.edit').on('click', function() {
					displayTiddler('edit', tiddler.title);
				});
				$mosaic.hide();
				window.scrollTo(0, 0);
				window.history.pushState({
					title: tiddler.title
				}, tiddler.title, '/'
					+ encodeURIComponent(tiddler.title));
			} else {
				console && console.log('error getting tiddler', arguments);
			}
		}, true);
	}

	function hijackLinks(ev) {
		var $el = $(this);
		if (!(ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)) {
			if ($el.hasClass('tag')) {
				$('.mosaic-title').text('#' + $el.text());
				window.location.hash = encodeURIComponent('#' + $el.text());
				populateMosaic(store().tag($el.text()));
				ev.preventDefault();
			} else if ($el.hasClass('title')) {
				displayTiddler($el.text());
				ev.preventDefault();
			}
		}
	}

	$('.mosaic').on('click', 'a', hijackLinks);
	$('.tiddler-detail').on('click', 'a', hijackLinks);

	$('.brand').on('click', function() {
		$('.mosaic-title').text('a TiddlySpace');
		window.location.hash = '';
		populateMosaic(store('!#excludeLists'));
	});

	$('.dropdown, .nav-button').on('click', function(ev) {
		var $el = $(ev.target);

		ev.stopPropagation();
		ev.preventDefault();

		if ($el.hasClass('all')) {
			$('.mosaic-title').text('a TiddlySpace');
			window.location.hash = '';
			populateMosaic(store('!#excludeLists'));
			$el.closest('.dropdown').removeClass('open');
		} else if ($el.hasClass('tag')) {
			$('.mosaic-title').text('#' + $el.text());
			window.location.hash = encodeURIComponent('#' + $el.text());
			populateMosaic(store().tag($el.text()));
			$el.closest('.dropdown').removeClass('open');
		} else if ($el.hasClass('space')) {
			$('.mosaic-title').text('@' + $el.text());
			window.location.hash = encodeURIComponent('@' + $el.text());
			populateMosaic(store().space($el.text()));
			$el.closest('.dropdown').removeClass('open');
			ev.preventDefault();
		} else if ($el.hasClass('load')) {
			var title = $el.data('title');
			if (title) {
				displayTiddler(title);
			}
		} else if ($el.closest('.dropdown-toggle').length) {
			$('.dropdown').each(function(i, el) {
				var $dropdown = $(el);
				if (el !== $el.closest('.dropdown')[0]) {
					$dropdown.removeClass('open')
				}
			});
			$el.closest('.dropdown').toggleClass('open');
		}
	});

	window.onpopstate = function(ev) {
		if (ev.state) {
			var title = ev.state.title;
			if (title) {
				displayTiddler(title);
			} else {
				closeTiddler();
			}
		}
	};

	$(document.body).on('click', function(ev) {
		$('.dropdown').removeClass('open');
	});

	$('.navbar-search').submit(function(ev) {
		ev.preventDefault();
		makeFat(function() {
			populateMosaic(search($(this).find('.search-query').val()));
		});
	});

	$('.search-query').keyup(fp.debounce((function() {
		var oldText = '';

		return function(ev) {
			var searchText = $(this).val();

			if (oldText !== searchText) {
				oldText = searchText;
				window.location.hash = encodeURIComponent(searchText);
				populateMosaic(search(searchText), '-searchScore');
			}
		};
	}()), 300));
}(jQuery));
