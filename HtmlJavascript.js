$(function() {
	var timeAgo = $.timeago(new Date($('.meta-modified').text())),
		author = $('.meta-modifier').text(),
		bag = $('.bag:first').text();

	$('<dd/>').html("last modified by " +
		'<a href="http://' + author + '.tiddlyspace.com">' + author +
		'</a> ' +
		timeAgo + ' in ' + '<a href="/bags/' + bag + '/tiddlers">'
			+ bag + '</a>')
		.addClass('time-and-creator')
		.prependTo('dl.meta.section');


	function editButton() {
		// leave if there's no tiddler to work with
		var wholething = $('#text-html.section');
		if (wholething.length == 0) return;

		var place = $("#container").length > 0 ? $("#container")[0] : document.body;
		var space = window.location.host.split(".")[0]
		var title = $("#title").text();
		var bagInfo = $('.bag').first().text().split(/_/);

		// don't show edit link if tiddler is not in this space
		if (bagInfo[0] !== space) return;

		function addLink() {
			$("<a class='plain-btn' id='editLink' />").attr('href'
				, '/edit#' + encodeURIComponent(title))
				.text("edit").prependTo(place);
		}

		// add edit link if user is member
		if (tiddlyweb && tiddlyweb.status) {
			if (tiddlyweb.status.space.recipe.match(/_private$/)) {
				addLink();
			}
		} else {
			$.ajax({ url: "/spaces/" + space + "/members",
				success: function(r) {
					if(r) {
						addLink();
					}
				}
			});
		}
	}

	editButton();

	$('.reply-btn').addClass('plain-btn').html('reply');

	$(document.body).append('<a class="plain-btn back" href="/">back</a>');

	console.log($('.reply-btn'));
});
