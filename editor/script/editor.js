/*
adv dialog todos:
- adv dialog creator SHOULD give us the containing div as well
- nested adv dialog
- "inner dialog block"
- special detection for text effects
- thought: I should make scripts error out if they try to access the dialog thing when it's in use?
- thought: instead of creating a special text effect list.. just store a bool on whether functions are allowed inside a dialog block
- thought: I should probably scrap the parser and start over
- thought: dialog and code "blocks" are kind of a terrible idea???
- why did I make sequences etc.. there own thing instead of just functions???

I'm a cat {wvy}awwww yeah{wvy}
{sequence
- a
- b
- c
}
>>>>> (cur)
- block dialog 
-- function print 
-- block code 
--- function wvy 
-- function print 
-- block code 
--- function wvy 
-- function br 
-- block code 
--- sequence 
---- block dialog 
----- function print 
---- block dialog 
----- function print 
---- block dialog 
----- function print
>>>>> (what I want)
- root (or something)
-- block dialog
--- function print
--- add_text_effect wvy
--- function print
--- remove_text_effect wvy
--- function br
-- sequence
--- block dialog 
---- function print 
--- block dialog 
---- function print 
--- block dialog 
---- function print


leftover todos:
- add "direct edit" dropdowns for exits when in "move" mode
- try another orientation on android fix
- need to update the instructions panel
- tool positioning in portrait mode
- encapsulate adv dialog logic and inventory logic
- encapsulate editor.js and bitsy.js
	- create separate runtime game data and editor game data
- should top bar go away on scroll down? (like some web apps do)
- should tools toggles go in a side-bar?
- saving and loading games in mobile
	- downloading blobs is not supported
	- thought: create "cartridges" out of GIFs (multiple frames means no limit on size even if dimensions are static)
	- store game data text in one byte per RGB pixel (reserve last 85 values in each color value: 85 * 3 = 255)
	- require implementation of lzw decompression and GIF decoding
	- should I create a standalone "bitsy player" page too that takes in the carts?

new notes from forum
- new game+
- process tags in "say" function
*/

/* MODES */
var EditMode = {
	Edit : 0,
	Play : 1
};

var EditorInputMode = {
	Mouse : 0,
	Touch : 1
};
var curEditorInputMode = EditorInputMode.Mouse;

// now I'm just using this as another way to refer to the engine type strings
var TileType = {
	Tile : "TIL",
	Sprite : "SPR",
	Item : "ITM",
};

/* EVENTS */
var events = new EventManager();

// TODO: what the heck is this helper function for?
function defParam(param,value) {
	return (param == undefined || param == null) ? value : param;
};

/* PALETTES */
function selectedColorPal() {
	return paletteTool.GetSelectedId();
};

/* UNIQUE ID METHODS */
// TODO - lots of duplicated code around stuff (ex: all these things with IDs)
function nextTileId() {
	return nextObjectId( sortedTileIdList() );
}

function nextSpriteId() {
	return nextObjectId( sortedSpriteIdList() );
}

function nextItemId() {
	return nextObjectId( sortedItemIdList() );
}

function nextRoomId() {
	return nextObjectId( sortedRoomIdList() );
}

function nextEndingId() {
	return nextObjectId( sortedEndingIdList() );
}

function nextPaletteId() {
	return nextObjectId( sortedPaletteIdList() );
}

// TODO : this naming is confusing now
function nextObjectId(idList) {
	if (idList.length <= 0) {
		return "0";
	}

	var lastId = idList[ idList.length - 1 ];
	var idInt = parseInt( lastId, 36 );
	idInt++;
	return idInt.toString(36);
}

// TODO... figure out how to move away from base36
// maybe sort alphabetically??
function sortedObjectIdList() {
	return sortedBase36IdList( object );
}

function sortedTileIdList() {
	return sortedBase36IdList( tile );
}

function sortedSpriteIdList() {
	return sortedBase36IdList( sprite );
}

function sortedItemIdList() {
	return sortedBase36IdList( item );
}

function sortedRoomIdList() {
	return sortedBase36IdList( room );
}

function sortedEndingIdList() {
	return sortedBase36IdList( ending );
}

function sortedPaletteIdList() {
	var keyList = Object.keys(palette);
	keyList.splice(keyList.indexOf("default"),1);
	var keyObj = {};
	for (var i = 0; i < keyList.length; i++) {
		keyObj[keyList[i]] = {};
	}

	return sortedBase36IdList( keyObj );
}

function sortedBase36IdList( objHolder ) {
	return Object.keys( objHolder ).sort( function(a,b) { return parseInt(a,36) - parseInt(b,36); } );
}

function nextAvailableDialogId(prefix) {
	if(prefix === undefined || prefix === null) prefix = "";
	var i = 0;
	var id = prefix + i.toString(36);
	while( dialog[id] != null ) {
		i++;
		id = prefix + i.toString(36);
	}
	return id;
}

/* NEW HEX ID SYSTEM HELPERS */
// TODO : vNext
// function nextScriptHexId() {
// 	return nextObjectHexId( sortedScriptHexIdList() );
// }

// function sortedScriptHexIdList() {
// 	return sortedHexIdList( script );
// }

function nextHexId(objHolder) {
	var idList = sortedHexIdList(objHolder);
	return nextObjectHexId(idList);
}

function nextObjectHexId(idList) { // TODO : rename
	if (idList.length <= 0) {
		return "0";
	}

	var lastId = idList[ idList.length - 1 ];
	var idInt = safeParseHex(lastId);
	idInt++;
	return idInt.toString(16);
}

function sortedHexIdList(objHolder) {
	var objectKeys = Object.keys(objHolder);

	var hexSortFunc = function(key1,key2) {
		return safeParseHex(key1,16) - safeParseHex(key2,16);
	};
	var hexSortedIds = objectKeys.sort(hexSortFunc);

	return hexSortedIds;
}

function safeParseHex(str) {
	var hexInt = parseInt(str,16);
	if (hexInt == undefined || hexInt == null || isNaN(hexInt)) {
		return -1;
	}
	else {
		return hexInt;
	}
}

/* UTILS */
function getContrastingColor(palId) {
	if (!palId) palId = curPal();
	var hsl = rgbToHsl( getPal(palId)[0][0], getPal(palId)[0][1], getPal(palId)[0][2] );
	// console.log(hsl);
	var lightness = hsl[2];
	if (lightness > 0.5) {
		return "#000";
	}
	else {
		return "#fff";
	}
}

function findAndReplaceTileInAllRooms( findTile, replaceTile ) {
	for (roomId in room) {
		for (y in room[roomId].tilemap) {
			for (x in room[roomId].tilemap[y]) {
				if (room[roomId].tilemap[y][x] === findTile) {
					room[roomId].tilemap[y][x] = replaceTile;
				}
			}
		}
	}
}

/* MAKE DRAWING OBJECTS */
// todo : need to share some of this code w/ the engine!
function makeObject(id,type,imageData) {
	var drwId = id;
	object[id] = {
		id : id,
		type : type,
		name : null,
		drw: drwId,
		col: (type === "TIL" ? 1 : 2),
		animation : { //todo
			isAnimated : (!imageData) ? false : (imageData.length>1), // more duplication :(
			frameIndex : 0,
			frameCount : (!imageData) ? 2 : imageData.length
		},
		inventory : {},
		dlg : null,
		actions : [],
		isWall : null,
		isPlayer : false,
		room : null,
		x : -1,
		y : -1,
	}
	makeDrawing(drwId,imageData);
}

function makeDrawing(id,imageData) {
	if (!imageData) {
		imageData = [[
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0],
			[0,0,0,0,0,0,0,0]
		]];
	}
	// TODO RENDERER : stop using global renderer
	renderer.SetImageSource(id,imageData);
	// TODO RENDERER : re-render images?
}

/* EVENTS */
function on_change_title(e) {
	title = e.target.value;
	refreshGameData();
	tryWarnAboutMissingCharacters(title);

	// hacky way to make sure ALL title textboxes remain up-to-date
	updateTitleTextBox(title);
}

function updateTitleTextBox(titleString) {
	var titleTextBoxes = document.getElementsByClassName("titleTextBox");
	for (var i = 0; i < titleTextBoxes.length; i++) {
		titleTextBoxes[i].value = titleString;
	}
}

/* MOBILE */
function mobileOffsetCorrection(off,e,innerSize) {
	var bounds = e.target.getBoundingClientRect();

	// var width = bounds.width * containerRatio;
	// var height = bounds.height * containerRatio;

	// correction for square canvas contained in rect
	if( bounds.width > bounds.height ) {
		off.x -= (bounds.width - bounds.height) / 2;
	}
	else if( bounds.height > bounds.width ) {
		off.y -= (bounds.height - bounds.width) / 2;
	}

	// console.log(off);

	// convert container size to internal canvas size
	var containerRatio = innerSize / Math.min( bounds.width, bounds.height );

	// console.log(containerRatio);

	off.x *= containerRatio;
	off.y *= containerRatio;

	// console.log(off);

	return off;
}

function tileTypeToIdPrefix(type) {
	if (type == TileType.Tile) {
		return "TIL_";
	}
	else if (type == TileType.Sprite || type == TileType.Avatar) {
		return "SPR_";
	}
	else if (type == TileType.Item) {
		return "ITM_";
	}
}

// hacky - assumes global paintTool object
function getCurDialogId() {
	return paintTool.GetCurDialogId();
}

function on_change_dialog_finished() {
	on_change_dialog();
	tryWarnAboutMissingCharacters( document.getElementById("dialogText").value );
}

// hacky - assumes global paintTool object
function on_change_dialog() {
	var dialogId = getCurDialogId();

	var dialogStr = document.getElementById("dialogText").value;
	if(dialogStr.length <= 0){
		if(dialogId) {
			paintTool.GetCurDrawing().dlg = null;
			delete dialog[dialogId];
		}
	}
	else {
		if(!dialogId) {
			dialogId = nextAvailableDialogId();
			paintTool.GetCurDrawing().dlg = dialogId;
		}
		dialog[dialogId] = scriptUtils.EnsureDialogBlockFormat(dialogStr);
	}

	reloadAdvDialogUI();

	refreshGameData();
}

function setDefaultGameState() {
	var defaultData = Resources["defaultGameData.bitsy"];
	// console.log("DEFAULT DATA \n" + defaultData);
	document.getElementById("game_data").value = defaultData;
	localStorage.game_data = document.getElementById("game_data").value; // save game
	clearGameData();
	parseWorld(document.getElementById("game_data").value); // load game

	// TODO RENDERER : refresh images
	// TODO -- more setup???
}

function newGameDialog() {
	var resetMessage = localization.GetStringOrFallback("reset_game_message", "Starting a new game will erase your old data. Consider exporting your work first! Are you sure you want to start over?");
	if (confirm(resetMessage)) {
		resetGameData();
	}
}

function resetGameData() {
	setDefaultGameState();

	// TODO : localize default_title
	title = localization.GetStringOrFallback("default_title", "Write your game's title here");
	dialog["SPR_0"] = localization.GetStringOrFallback("default_sprite_dlg", "I'm a cat"); // hacky to do this in two places :(
	dialog["ITM_0"] = localization.GetStringOrFallback("default_item_dlg", "You found a nice warm cup of tea");

	pickDefaultFontForLanguage(localization.GetLanguage());

	// todo wrap these variable resets in a function
	tileIndex = 0;
	spriteIndex = 0;

	refreshGameData();

	// TODO RENDERER : refresh images
	updateExitOptionsFromGameData();
	updateRoomName();
	updateInventoryUI();
	updateFontSelectUI(); // hmm is this really the place for this?

	paintTool.updateCanvas(); // hacky - assumes global paintTool and roomTool

	markerTool.Clear(); // hacky -- should combine more of this stuff together
	markerTool.SetRoom(curRoom);
	markerTool.Refresh();
	roomTool.drawEditMap();

	updateTitleTextBox(title);

	events.Raise("game_data_change"); // TODO -- does this need to have a specific reset event or flag?
}

function refreshGameData() {
	if (isPlayMode) {
		return; //never store game data while in playmode (TODO: wouldn't be necessary if the game data was decoupled form editor data)
	}

	flags.ROOM_FORMAT = 1; // always save out comma separated format, even if the old format is read in

	// var gameData = serializeWorld();

	// document.getElementById("game_data").value = gameData; // TODO : this is where the slow down is

	var gameDataNoFonts = serializeWorld(true);
	document.getElementById("game_data").value = showFontDataInGameData ? serializeWorld() : gameDataNoFonts;

	// localStorage.setItem("game_data", gameData); //auto-save

	localStorage.setItem("game_data", gameDataNoFonts);
}

/* TIMER */
function Timer() {
	var start = Date.now();

	this.Seconds = function() {
		return Math.floor( (Date.now() - start) / 1000 );
	}

	this.Milliseconds = function() {
		return Date.now() - start;
	}
}

var editMode = EditMode.Edit; // TODO : move to core.js?

/* TOOL CONTROLLERS */
var roomTool;
var paintTool;

/* ROOM */
var roomIndex = 0;

/* ENDINGS */
var endingIndex = 0;

/* BROWSER COMPATIBILITY */
var browserFeatures = {
	colorPicker : false,
	fileDownload : false,
	blobURL : false
};

/* SCREEN CAPTURE */
var gifencoder = new gif();
var gifFrameData = [];

var isPlayMode = false;

/* EXPORT HTML */
var makeURL = null;
var exporter = new Exporter();

/* FONT MANAGER */
var defaultFonts = [
		"ascii_small.bitsyfont",
		"unicode_european_small.bitsyfont",
		"unicode_european_large.bitsyfont",
		"unicode_asian.bitsyfont",
		"arabic.bitsyfont",
	];
fontManager = new FontManager(defaultFonts); // replaces font manager in the engine with one containing all fonts loaded in the editor

function detectBrowserFeatures() {
	console.log("BROWSER FEATURES");
	//test feature support
	try {
		var input = document.createElement("input");
		input.type = "color";
		document.body.appendChild(input);

		if (input.type === "color") {
			console.log("color picker supported!");
			browserFeatures.colorPicker = true;
		} else {
			browserFeatures.colorPicker = false;
		}

		if(input.offsetWidth <= 10 && input.offsetHeight <= 10) {
			// console.log(input.clientWidth);
			console.log("WEIRD SAFARI COLOR PICKER IS BAD!");
			browserFeatures.colorPicker = false;
			document.getElementById("pageColor").type = "text";
		}
		
		document.body.removeChild(input);
	} catch(e) {
		browserFeatures.colorPicker = false;
	}

	var a = document.createElement('a');
	if (typeof a.download != "undefined") {
		console.log("downloads supported!");
		browserFeatures.fileDownload = true;
	}
	else {
		browserFeatures.fileDownload = false;
	}

	browserFeatures.blobURL = (!!new Blob) && (URL != undefined || webkitURL != undefined);
	if( browserFeatures.blobURL ) {
		console.log("blob supported!");
		makeURL = URL || webkitURL;
	}
}

function hasUnsupportedFeatures() {
	return /*!browserFeatures.colorPicker ||*/ !browserFeatures.fileDownload;
}
// NOTE: No longer relying on color picker feature

function showUnsupportedFeatureWarning() {
	document.getElementById("unsupportedFeatures").style.display = "block";
}

function hideUnsupportedFeatureWarning() {
	document.getElementById("unsupportedFeatures").style.display = "none";
}

// This is the panel arrangement you get if you are new or your editor settings are out-of-date
var defaultPanelPrefs = {
	workspace : [
		{ id:"aboutPanel", 			visible:true, 	position:0  },
		{ id:"roomPanel", 			visible:true, 	position:1  },
		{ id:"paintPanel", 			visible:true, 	position:2  },
		{ id:"colorsPanel", 		visible:true, 	position:3  },
		{ id:"downloadPanel", 		visible:true, 	position:4  },
		{ id:"gifPanel", 			visible:false, 	position:5  },
		{ id:"dataPanel", 			visible:false, 	position:6  },
		{ id:"exitsPanel", 			visible:false, 	position:7  },
		{ id:"paintExplorerPanel",	visible:false,	position:9  },
		{ id:"dialogPanel",			visible:false,	position:10 },
		{ id:"inventoryPanel",		visible:false,	position:11 },
		{ id:"settingsPanel",		visible:false,	position:12 },
	]
};
// console.log(defaultPanelPrefs);

function getPanelPrefs() {
	// (TODO: weird that engine version and editor version are the same??)
	var useDefaultPrefs = ( localStorage.engine_version == null ) ||
							( localStorage.panel_prefs == null ) ||
							( JSON.parse(localStorage.engine_version).major < 6 ) ||
							( JSON.parse(localStorage.engine_version).minor < 0 );

	var prefs = useDefaultPrefs ? defaultPanelPrefs : JSON.parse( localStorage.panel_prefs );

	// add missing panel prefs (if any)
	// console.log(defaultPanelPrefs);
	for( var i = 0; i < defaultPanelPrefs.workspace.length; i++ ) {
		var isMissing = true;
		var panelPref = defaultPanelPrefs.workspace[i];
		for( var j = 0; j < prefs.workspace.length; j++ )
		{
			if( prefs.workspace[j].id === panelPref.id ) {
				isMissing = false;
			}
		}

		if( isMissing ) {
			prefs.workspace.push( panelPref );
		}
	}

	return prefs;
}

var urlFlags = {};
function readUrlFlags() {
	console.log("@@@@@ FLAGGS")
	var urlSplit = window.location.href.split("?");
	if (urlSplit.length > 1) {
		for(var i = 1; i < urlSplit.length; i++) {
			var flagSplit = urlSplit[i].split("=");
			urlFlags[ flagSplit[0] ] = flagSplit[1];
		}
	}
	console.log(urlFlags);
}

function isPortraitOrientation() {
	var isPortrait = false;

	if (window.screen.orientation != undefined) {
		// most browsers
		isPortrait = window.screen.orientation.type.includes("portrait");
	}
	else if (window.orientation != undefined) {
		// iOS safari
		isPortrait = window.orientation == 0 || window.orientation == 180;
	}

	return isPortrait;
}

function start() {
	events.Listen("game_data_change", function(event) {
		updatePaletteOptionsFromGameData();

		// TODO -- over time I can move more things in here
		// on the other hand this is still sort of global thing that we don't want TOO much of
	});

	isPlayerEmbeddedInEditor = true; // flag for game player to make changes specific to editor

	var versionLabelElements = document.getElementsByClassName("curVersionLabel");
	for (var labelIndex in versionLabelElements) {
		var versionLabel = versionLabelElements[labelIndex];
		versionLabel.innerText = "v" + version.major + "." + version.minor;
	}

	detectBrowserFeatures();

	readUrlFlags();

	// localization
	if (urlFlags["lang"] != null) {
		localStorage.editor_language = urlFlags["lang"]; // need to verify this is real language?
	}
	localization = new Localization();

	//game canvas & context (also the map editor)
	attachCanvas( document.getElementById("game") );

	//init tool controllers
	roomTool = new RoomTool(canvas);
	roomTool.listenEditEvents()
	roomTool.editDrawingAtCoordinateCallback = editDrawingAtCoordinate;

	paintTool = new PaintTool(document.getElementById("paint"));

	markerTool = new RoomMarkerTool(document.getElementById("markerCanvas1"), document.getElementById("markerCanvas2") );
	console.log("MARKER TOOL " + markerTool);

	roomTool.markers = markerTool;

	//
	drawingThumbnailCanvas = document.createElement("canvas");
	drawingThumbnailCanvas.width = 8 * scale;
	drawingThumbnailCanvas.height = 8 * scale;
	drawingThumbnailCtx = drawingThumbnailCanvas.getContext("2d");

	// load custom font
	if (localStorage.custom_font != null) {
		var fontStorage = JSON.parse(localStorage.custom_font);
		fontManager.AddResource(fontStorage.name + ".bitsyfont", fontStorage.fontdata);
	}
	resetMissingCharacterWarning();

	//load last auto-save
	if (localStorage.game_data) {
		//console.log("~~~ found old save data! ~~~");
		//console.log(localStorage.game_data);
		document.getElementById("game_data").value = localStorage.game_data;
		on_game_data_change_core();
	}
	else {
		setDefaultGameState();
	}

	roomIndex = sortedRoomIdList().indexOf(curRoom);

	markerTool.SetRoom(curRoom);

	// load panel preferences
	var prefs = getPanelPrefs();
	localStorage.panel_prefs = JSON.stringify(prefs); // save loaded prefs
	var sortedWorkspace = prefs.workspace.sort( function(a,b) { return a.position - b.position; } );
	var editorContent = document.getElementById("editorContent");
	for(i in sortedWorkspace) {
		var panelSettings = sortedWorkspace[i];
		var panelElement = document.getElementById(panelSettings.id);
		if (panelElement != undefined && panelElement != null) {
			togglePanelCore( panelSettings.id, panelSettings.visible, false /*doUpdatePrefs*/ );
			editorContent.insertBefore( panelElement, null ); //insert on the left
		}
	}

	// Automatically open tool trays that are needed (does this even work??)
	if (sortedRoomIdList().length > 1)
	{
		toggleRoomToolsCore( true );
	}
	if (sortedPaletteIdList().length > 1)
	{
		togglePaletteToolsCore( true );
	}

	//draw everything
	paintTool.updateCanvas(); // TODO -- is there more to update now?
	markerTool.Refresh();
	roomTool.drawEditMap();

	updateRoomPaletteSelect(); //dumb to have to specify this here --- wrap up room UI method?
	updateRoomName(); // init the room UI

	document.getElementById("inventoryOptionItem").checked = true; // a bit hacky
	updateInventoryUI();

	// init color picker
	colorPicker = new ColorPicker('colorPickerWheel', 'colorPickerSelect', 'colorPickerSliderThumb', 'colorPickerSliderBg', 'colorPickerHexText');
	document.getElementById("colorPaletteOptionBackground").checked = true;
	paletteTool = new PaletteTool(colorPicker,["colorPaletteLabelBackground", "colorPaletteLabelTile", "colorPaletteLabelSprite"],"paletteName");
	events.Listen("palette_change", function(event) {
		refreshGameData();
	});
	events.Listen("palette_list_change", function(event) {
		refreshGameData();
		updatePaletteOptionsFromGameData();
	});

	// init paint explorer
	paintExplorer = new PaintExplorer("paintExplorer",selectPaint);
	paintExplorer.Refresh(TileType.Avatar); // TODO : remove this
	paintExplorer.ChangeSelection("A"); // TODO : remove this too!
	paintExplorer.SetDisplayCaptions( true );

	//unsupported feature stuff
	if (hasUnsupportedFeatures() && !isPortraitOrientation()) {
		showUnsupportedFeatureWarning();
	}
	if (!browserFeatures.fileDownload) {
		document.getElementById("downloadHelp").style.display = "block";
	}

	// gif recording init (should this go in its own file?)
	gifCaptureCanvas = document.createElement("canvas");
	gifCaptureCanvas.width = width * scale;
	gifCaptureCanvas.height = width * scale;
	gifCaptureCtx = gifCaptureCanvas.getContext("2d");

	onInventoryChanged = function(id) {
		updateInventoryUI();
	
		// animate to draw attention to change
		document.getElementById("inventoryItem_" + id).classList.add("flash");
		setTimeout(
			function() {
				// reset animations
				document.getElementById("inventoryItem_" + id).classList.remove("flash");
			},
			400
		);
	};

	onVariableChanged = function(id) {
		updateInventoryUI();
	
		// animate to draw attention to change
		document.getElementById("inventoryVariable_" + id).classList.add("flash");
		setTimeout(
			function() {
				// reset animations
				document.getElementById("inventoryVariable_" + id).classList.remove("flash");
			},
			400
		);
	};

	onGameReset = function() {
		updateInventoryUI();
	}

	//color testing
	// on_change_color_bg();
	// on_change_color_tile();
	// on_change_color_sprite();

	// save latest version used by editor (for compatibility)
	localStorage.engine_version = JSON.stringify( version );

	// load saved export settings
	if( localStorage.export_settings ) {
		export_settings = JSON.parse( localStorage.export_settings );
		document.getElementById("pageColor").value = export_settings.page_color;
	}

	// TODO : interesting idea but needs work!
	// // try to honor state of all checkboxes from previous session
	// var inputElements = document.getElementsByTagName("input");
	// for (var i in inputElements) {
	// 	if (inputElements[i].type === "checkbox") {
	// 		var checkbox = inputElements[i];
	// 		if (checkbox.checked) {
	// 			console.log(checkbox);
	// 			checkbox.dispatchEvent(new Event("click"));
	// 		}
	// 	}
	// }

	initLanguageOptions();

	// TODO... this might not work as the default ID forever
	events.Raise("select_drawing", {id:"A"});
}

function newDrawing(type) {
	paintTool.newDrawing(type);
}

function updateRoomName() {
	if (curRoom == null) { 
		return;
	}

	// document.getElementById("roomId").innerHTML = curRoom;
	var roomLabel = localization.GetStringOrFallback("room_label", "room");
	document.getElementById("roomName").placeholder = roomLabel + " " + curRoom;
	if(room[curRoom].name != null) {
		document.getElementById("roomName").value = room[curRoom].name;
	}
	else {
		document.getElementById("roomName").value = "";
	}
}

// TODO : consolidate these function and rename them something nicer
function on_room_name_change() {
	var str = document.getElementById("roomName").value;
	if(str.length > 0) {
		room[curRoom].name = str;
	}
	else {
		room[curRoom].name = null;
	}

	updateNamesFromCurData()

	refreshGameData();
}

function on_drawing_name_change() {
	var str = document.getElementById("drawingName").value;
	var obj = paintTool.GetCurDrawing();

	var oldName = obj.name;
	if(str.length > 0) {
		obj.name = str;
	}
	else {
		obj.name = null;
	}

	updateNamesFromCurData()

	// update display name for thumbnail
	var displayName = obj.name ? obj.name : getCurPaintModeStr() + " " + obj.id;
	paintExplorer.ChangeThumbnailCaption(obj.id, displayName);

	// make sure items referenced in scripts update their names
	if(obj.type === TileType.Item) {
		// console.log("SWAP ITEM NAMES");

		var ItemNameSwapVisitor = function() {
			var didSwap = false;
			this.DidSwap = function() { return didSwap; };

			this.Visit = function(node) {
				// console.log("VISIT!");
				// console.log(node);

				if( node.type != "function" || node.name != "item" )
					return; // not the right type of node
				
				if( node.arguments.length <= 0 || node.arguments[0].type != "literal" )
					return; // no argument available

				if( node.arguments[0].value === oldName ) { // do swap
					node.arguments[0].value = newName;
					didSwap = true;
				}
			};
		};

		var newName = obj.name;
		if (newName === null || newName === undefined) {
			newName = obj.id;
		}
		if (oldName === null || oldName === undefined) {
			oldName = obj.id;
		}

		// console.log(oldName + " <-> " + newName);

		if(newName != oldName) {
			for(dlgId in dialog) {
				// console.log("DLG " + dlgId);
				var dialogScript = scriptInterpreter.Parse( dialog[dlgId] );
				var visitor = new ItemNameSwapVisitor();
				dialogScript.VisitAll( visitor );
				if( visitor.DidSwap() ) {
					var newDialog = dialogScript.Serialize();
					if(newDialog.indexOf("\n") > -1) {
						newDialog = '"""\n' + newDialog + '\n"""';
					}
					dialog[dlgId] = newDialog;
				}
			}
		}

		updateInventoryItemUI();

		// renderPaintThumbnail( drawing.id ); // hacky way to update name
	}

	refreshGameData();
	// console.log(names);
}

function on_palette_name_change(event) {
	paletteTool.ChangeSelectedPaletteName(event.target.value);
}

function selectRoom(roomId) {
	console.log("SELECT ROOM " + roomId);

	// ok watch out this is gonna be hacky
	var ids = sortedRoomIdList();

	var nextRoomIndex = -1;
	for (var i = 0; i < ids.length; i++) {
		if (ids[i] === roomId) {
			nextRoomIndex = i;
		}
	}

	if (nextRoomIndex != -1) {
		roomIndex = nextRoomIndex;
		curRoom = ids[roomIndex];
		markerTool.SetRoom(curRoom);
		roomTool.drawEditMap();
		paintTool.updateCanvas();
		updateRoomPaletteSelect();
		paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );

		if (drawing.type === TileType.Tile) {
			paintTool.updateWallCheckboxOnCurrentTile();
		}

		updateRoomName();
	}
}

function nextRoom() {
	var ids = sortedRoomIdList();
	roomIndex = (roomIndex + 1) % ids.length;
	curRoom = ids[roomIndex];
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();
	paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );

	if (drawing.type === TileType.Tile) {
		paintTool.updateWallCheckboxOnCurrentTile();
	}

	updateRoomName();
}

function prevRoom() {
	var ids = sortedRoomIdList();
	roomIndex--;
	if (roomIndex < 0) roomIndex = (ids.length-1);
	curRoom = ids[roomIndex];
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();
	paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );

	if (drawing.type === TileType.Tile) {
		paintTool.updateWallCheckboxOnCurrentTile();
	}

	updateRoomName();
}

function duplicateRoom() {
	var copyRoomId = sortedRoomIdList()[roomIndex];
	var roomToCopy = room[ copyRoomId ];

	roomIndex = Object.keys( room ).length;
	var newRoomId = nextRoomId();

	console.log(newRoomId);
	var duplicateTilemap = [];
	for (y in roomToCopy.tilemap) {
		duplicateTilemap.push([]);
		for (x in roomToCopy.tilemap[y]) {
			duplicateTilemap[y].push( roomToCopy.tilemap[y][x] );
		}
	}

	var duplicateExits = [];
	for (i in roomToCopy.exits) {
		var exit = roomToCopy.exits[i];
		duplicateExits.push( duplicateExit( exit ) );
	}

	room[newRoomId] = {
		id : newRoomId,
		tilemap : duplicateTilemap,
		walls : roomToCopy.walls.slice(0),
		exits : duplicateExits,
		endings : roomToCopy.endings.slice(0),
		pal : roomToCopy.pal,
		items : []
	};
	refreshGameData();

	curRoom = newRoomId;
	//console.log(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();

	updateRoomName();

	// add new exit destination option to exits panel
	var select = document.getElementById("exitDestinationSelect");
	var option = document.createElement("option");
	var roomLabel = localization.GetStringOrFallback("room_label", "room");
	option.text = roomLabel + " " + newRoomId;
	option.value = newRoomId;
	select.add(option);
}

function duplicateExit(exit) {
	var newExit = {
		x : exit.x,
		y : exit.y,
		dest : {
			room : exit.dest.room,
			x : exit.dest.x,
			y : exit.dest.y
		}
	}
	return newExit;
}

function newRoom() {
	roomIndex = Object.keys( room ).length;
	var roomId = nextRoomId();

	var palIdList = sortedPaletteIdList();
	var palId = palIdList.length > 0 ? palIdList[0] : "default";

	console.log(roomId);
	room[roomId] = {
		id : roomId,
		tilemap : [
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"],
				["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]
			],
		walls : [],
		exits : [],
		endings : [],
		pal : palId,
		objects : [],
	};
	refreshGameData();

	curRoom = roomId;
	//console.log(curRoom);
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	updateRoomPaletteSelect();

	updateRoomName();

	// add new exit destination option to exits panel
	// var select = document.getElementById("exitDestinationSelect");
	// var option = document.createElement("option");
	// var roomLabel = localization.GetStringOrFallback("room_label", "room");
	// option.text = roomLabel + " " + roomId;
	// option.value = roomId;
	// select.add(option);
}

function deleteRoom() {
	if ( Object.keys(room).length <= 1 ) {
		alert("You can't delete your only room!");
	}
	else if ( confirm("Are you sure you want to delete this room? You can't get it back.") ) {
		var roomId = sortedRoomIdList()[roomIndex];

		// delete exits in _other_ rooms that go to this room
		for( r in room )
		{
			if( r != roomId) {
				for( i in room[r].exits )
				{
					if( room[r].exits[i].dest.room === roomId )
					{
						room[r].exits.splice( i, 1 );
					}
				}
			}
		}

		delete room[roomId];

		refreshGameData();

		markerTool.Clear();
		nextRoom();
		roomTool.drawEditMap();
		paintTool.updateCanvas();
		updateRoomPaletteSelect();
		markerTool.Refresh();
		// updateExitOptionsFromGameData();
		//recreate exit options
	}
}

function next() {
	paintTool.NextDrawing();
	// paintExplorer.ChangeSelection( drawing.id );
}

function prev() {
	paintTool.PrevDrawing();
	// paintExplorer.ChangeSelection( drawing.id );
}

function duplicateDrawing() {
	paintTool.DuplicateDrawing();
}

function removeAllObjects( id ) {
	function getFirstObjectIndex(roomId, objId) {
		for(var i = 0; i < room[roomId].objectLocations.length; i++) {
			if(room[roomId].objectLocations[i].id === objId)
				return i;
		}
		return -1;
	}

	for (roomId in room) {
		var i = getFirstObjectIndex(roomId, id);
		while (i > -1) {
			room[roomId].objectLocations.splice(i,1);
			i = getFirstObjectIndex(roomId, id);
		}
	}
}

// SCRIPT EDITOR
// TODO : better name?
var scriptEditorModule = new ScriptEditor();
var curScriptEditor = null;
function reloadAdvDialogUI() {
	// TODO : should I remove this entirely?

	// // TODO.. the global use of the paint tool is a little unfortunate
	// var curDrawing = paintTool.GetCurDrawing();

	// if (curDrawing.type === TileType.Sprite || curDrawing.type === TileType.Item) {

	// 	document.getElementById("dialogEditorHasContent").style.display = "block";
	// 	document.getElementById("dialogEditorNoContent").style.display = "none";

	// 	var dialogStr = document.getElementById("dialogText").value;

	// 	// clear out the old editor
	// 	var dialogFormDiv = document.getElementById("advDialogViewport");
	// 	dialogFormDiv.innerHTML = "";

	// 	curScriptEditor = scriptEditorModule.CreateEditor(dialogStr);
	// 	curScriptEditor.OnChangeHandler = function() {
	// 		// TODO... respond to changes (needs to handle all cases, such as deletion!)
	// 		console.log("CHANGE!!!!");
	// 		console.log(curScriptEditor.Serialize());
	// 		dialog[getCurDialogId()] = curScriptEditor.Serialize();
	// 		refreshGameData();
	// 	};
	// 	dialogFormDiv.appendChild(curScriptEditor.GetElement());
	// }
	// else {
	// 	document.getElementById("dialogEditorHasContent").style.display = "none";
	// 	document.getElementById("dialogEditorNoContent").style.display = "block";
	// }
}

// TODO ... is this the right place for this?
events.Listen("select_action", function(event) {
	// TODO : rename things to be non-dialog-y
	var actionScriptSource = action[event.id].source;

	// clear out the old editor
	var dialogFormDiv = document.getElementById("advDialogViewport");
	dialogFormDiv.innerHTML = "";

	curScriptEditor = scriptEditorModule.CreateEditor(actionScriptSource);
	curScriptEditor.OnChangeHandler = function() {
		// TODO... respond to changes (needs to handle all cases, such as deletion!)
		console.log("CHANGE!!!!");
		console.log(curScriptEditor.Serialize());
		console.log(curScriptEditor.VisualizeTree());
		// dialog[getCurDialogId()] = curScriptEditor.Serialize();
		action[event.id].source = curScriptEditor.Serialize();
		refreshGameData();
	};
	dialogFormDiv.appendChild(curScriptEditor.GetElement());
});

function deleteDrawing() {
	paintTool.deleteDrawing();
}

function toggleToolBar(e) {
	if( e.target.checked ) {
		document.getElementById("toolsPanel").style.display = "flex";
		document.getElementById("toolsCheckIcon").innerHTML = "expand_more";
	}
	else {
		document.getElementById("toolsPanel").style.display = "none";
		document.getElementById("toolsCheckIcon").innerHTML = "expand_less";
	}
}

function toggleRoomTools(e) {
	toggleRoomToolsCore( e.target.checked );
}

function toggleRoomToolsCore(visible) {
	if( visible ) {
		document.getElementById("roomTools").style.display = "block";
		document.getElementById("roomToolsCheck").checked = true;
		document.getElementById("roomToolsCheckIcon").innerHTML = "expand_more";
	}
	else {
		document.getElementById("roomTools").style.display = "none";
		document.getElementById("roomToolsCheck").checked = false;
		document.getElementById("roomToolsCheckIcon").innerHTML = "expand_less";
	}
}

function togglePaletteTools(e) {
	togglePaletteToolsCore( e.target.checked );
}

function togglePaletteToolsCore(visible) {
	if( visible ) {
		document.getElementById("paletteTools").style.display = "block";
		document.getElementById("paletteToolsCheckIcon").innerHTML = "expand_more";
	}
	else {
		document.getElementById("paletteTools").style.display = "none";
		document.getElementById("paletteToolsCheckIcon").innerHTML = "expand_less";
	}
}

function toggleDownloadOptions(e) {
	if( e.target.checked ) {
		document.getElementById("downloadOptions").style.display = "block";
		document.getElementById("downloadOptionsCheckIcon").innerHTML = "expand_more";
	}
	else {
		document.getElementById("downloadOptions").style.display = "none";
		document.getElementById("downloadOptionsCheckIcon").innerHTML = "expand_less";
	}
}

function on_edit_mode() {
	isPlayMode = false;
	stopGame();
	// TODO I should really do more to separate the editor's game-data from the engine's game-data
	parseWorld(document.getElementById("game_data").value); //reparse world to account for any changes during gameplay

	curRoom = sortedRoomIdList()[roomIndex]; //restore current room to pre-play state

	roomTool.drawEditMap();
	roomTool.listenEditEvents();

	markerTool.RefreshKeepSelection();

	updateInventoryUI();

	if(isPreviewDialogMode) {
		isPreviewDialogMode = false;
		updatePreviewDialogButton();

		for(var i = 0; i < advDialogUIComponents.length; i++) {
			advDialogUIComponents[i].GetEl().classList.remove("highlighted");
		}
	}
	document.getElementById("previewDialogCheck").disabled = false;
}

// hacky - part of hiding font data from the game data
function getFullGameData() {
	// return document.getElementById("game_data").value + fontManager.GetData(fontName);
	return serializeWorld();
}

function on_play_mode() {
	isPlayMode = true;

	roomTool.unlistenEditEvents();

	// load_game(document.getElementById("game_data").value, !isPreviewDialogMode /* startWithTitle */);
	load_game(getFullGameData(), !isPreviewDialogMode /* startWithTitle */);

	console.log("PLAY!! ~~ PREVIEW ? " + isPreviewDialogMode);
	if(!isPreviewDialogMode) {
		console.log("DISALBE PREVIEW!!!");
		document.getElementById("previewDialogCheck").disabled = true;
	}
}

function updatePlayModeButton() {
	document.getElementById("playModeCheck").checked = isPlayMode;
	document.getElementById("playModeIcon").innerHTML = isPlayMode ? "stop" : "play_arrow";

	var stopText = localization.GetStringOrFallback("stop_game", "stop");
	var playText = localization.GetStringOrFallback("play_game", "play");
	document.getElementById("playModeText").innerHTML = isPlayMode ? stopText : playText;
}

function updatePreviewDialogButton() {
	document.getElementById("previewDialogCheck").checked = isPreviewDialogMode;
	document.getElementById("previewDialogIcon").innerHTML = isPreviewDialogMode ? "stop" : "play_arrow";

	var stopText = localization.GetStringOrFallback("stop_game", "stop");
	var previewText = localization.GetStringOrFallback("dialog_start_preview", "preview");
	document.getElementById("previewDialogText").innerHTML = isPreviewDialogMode ? stopText : previewText;
}

function togglePaintGrid(e) {
	paintTool.drawPaintGrid = e.target.checked;
	document.getElementById("paintGridIcon").innerHTML = paintTool.drawPaintGrid ? "visibility" : "visibility_off";
	paintTool.updateCanvas();
}

function toggleMapGrid(e) {
	roomTool.drawMapGrid = e.target.checked;
	document.getElementById("roomGridIcon").innerHTML = roomTool.drawMapGrid ? "visibility" : "visibility_off";
	roomTool.drawEditMap();
}

function toggleCollisionMap(e) {
	roomTool.drawCollisionMap = e.target.checked;
	document.getElementById("roomWallsIcon").innerHTML = roomTool.drawCollisionMap ? "visibility" : "visibility_off";
	roomTool.drawEditMap();
}

var showFontDataInGameData = false;
function toggleFontDataVisibility(e) {
	showFontDataInGameData = e.target.checked;
	document.getElementById("fontDataIcon").innerHTML = e.target.checked ? "visibility" : "visibility_off";
	refreshGameData(); // maybe a bit expensive
}

/* PALETTE STUFF */
var colorPicker = null;
var paletteTool = null;
var paintExplorer = null;

function updateRoomPaletteSelect() {
	var palOptions = document.getElementById("roomPaletteSelect").options;
	for (i in palOptions) {
		var o = palOptions[i];
		// console.log(o);
		if (o.value === curPal()) {
			o.selected = true;
		}
	}
}

function changeColorPickerIndex(index) {
	paletteTool.changeColorPickerIndex(index);
}

function updatePaletteOptionsFromGameData() {
	if (curRoom == null) {
		return;
	}

	var select = document.getElementById("roomPaletteSelect");

	// first, remove all current options
	var i;
	for(i = select.options.length - 1 ; i >= 0 ; i--) {
		select.remove(i);
	}

	// then, add an option for each room
	var paletteLabel = localization.GetStringOrFallback("palette_label", "palette");
	for (palId in palette) {
		if (palId != "default") {
			var option = document.createElement("option");
			option.text = palette[palId].name ? palette[palId].name : paletteLabel + " " + palId;
			option.value = palId;
			option.selected = ( palId === room[ curRoom ].pal );
			select.add(option);
		}
	}
}

function prevPalette() {
	paletteTool.SelectPrev();
}

function nextPalette() {
	paletteTool.SelectNext();
}

function newPalette() {
	paletteTool.AddNew();
}

function duplicatePalette() {
	paletteTool.AddDuplicate();
}

function deletePalette() {
	paletteTool.DeleteSelected();
}

function roomPaletteChange(event) {
	var palId = event.target.value;
	room[curRoom].pal = palId;
	refreshGameData();
	markerTool.SetRoom(curRoom);
	roomTool.drawEditMap();
	paintTool.updateCanvas();
	paintExplorer.Refresh( paintTool.drawing.type, true /*doKeepOldThumbnails*/ );
}

function updateDrawingNameUI(visible) {
	document.getElementById("drawingNameUI").setAttribute("style", visible ? "display:initial;" : "display:none;");

	var obj = paintTool.GetCurDrawing();

	if(obj.name != null) {
		document.getElementById("drawingName").value = obj.name;
	}
	else {
		document.getElementById("drawingName").value = "";
	}

	document.getElementById("drawingName").placeholder = getCurPaintModeStr() + " " + obj.id;

	// hacky update to type indicator
	document.getElementById("drawingTypeLabel").innerText = obj.type + (obj.isPlayer ? "*" : "");
}

function paintExplorerFilterChange( e ) {
	console.log("paint explorer filter : " + e.target.value);
	paintExplorer.Refresh( paintTool.drawing.type, true, e.target.value );
}

// TODO... redo this
function editDrawingAtCoordinate(x,y) {
	var spriteId = getSpriteAt(x,y); // todo: need more consistency with these methods
	// console.log(spriteId);
	if(spriteId) {
		if(spriteId === "A") {
			on_paint_avatar_ui_update();
		}
		else {
			on_paint_sprite_ui_update();
		}

		var drawing = new DrawingId( spriteId === "A" ? TileType.Avatar : TileType.Sprite, spriteId );
		paintTool.selectDrawing( drawing );
		paintExplorer.RefreshAndChangeSelection( drawing );
		return;
	}

	var item = getItem(curRoom,x,y);
	// console.log(item);
	if(item) {
		on_paint_item_ui_update();
		var drawing = new DrawingId( TileType.Item, item.id );
		paintTool.selectDrawing( drawing );
		paintExplorer.RefreshAndChangeSelection( drawing );
		return;
	}

	var tileId = getTile(x,y);
	// console.log(tileId);
	if(tileId != 0) {
		on_paint_tile_ui_update(); // really wasteful probably
		var drawing = new DrawingId( TileType.Tile, tileId );
		paintTool.selectDrawing( drawing );
		paintExplorer.RefreshAndChangeSelection( drawing );
		return;
	}
}

function selectPaint() {
	if(drawing.id === this.value && document.getElementById("paintPanel").style.display === "none") {
		togglePanelCore("paintPanel", true /*visible*/); // animate?
	}

	drawing.id = this.value;
	if( drawing.type === TileType.Tile ) {
		tileIndex = sortedTileIdList().indexOf( drawing.id );
		paintTool.reloadDrawing();
	}
	else if( drawing.type === TileType.Item ) {
		itemIndex = sortedItemIdList().indexOf( drawing.id );
		paintTool.reloadDrawing();
	}
	else {
		spriteIndex = sortedSpriteIdList().indexOf( drawing.id );
		paintTool.reloadDrawing();
	}
}

// TODO.. should I remove this?
function getCurPaintModeStr() {
	var curDrawingType = paintTool.GetCurDrawing().type;

	if (curDrawingType === TileType.Sprite) {
		return localization.GetStringOrFallback("sprite_label", "sprite");
	}
	else if (curDrawingType === TileType.Item) {
		return localization.GetStringOrFallback("item_label", "item");
	}
	else if (curDrawingType === TileType.Tile) {
		return localization.GetStringOrFallback("tile_label", "tile");
	}
}

function on_change_adv_dialog() {
	document.getElementById("dialogText").value = document.getElementById("dialogCodeText").value;
	on_change_dialog();
}

function on_game_data_change() {
	on_game_data_change_core();

	refreshGameData();

	// ui stuff
	markerTool.Refresh(); // wow I hope this doesn't cause bugs
	updateRoomName();
	refreshGameData();
}

function convertGameDataToCurVersion(importVersion) {
	if (importVersion < 5.0) {
		console.log("version under 5!!!!");

		var PrintFunctionVisitor = function() {
			var didChange = false;
			this.DidChange = function() { return didChange; };

			this.Visit = function(node) {
				if ( node.type != "function" )
					return;

				// console.log("VISIT " + node.name);

				if ( node.name === "say" ) {
					node.name = "print";
					didChange = true;
				}
			};
		};

		for(dlgId in dialog) {
			var dialogScript = scriptInterpreter.Parse( dialog[dlgId] );
			var visitor = new PrintFunctionVisitor();
			dialogScript.VisitAll( visitor );
			if( visitor.DidChange() ) {
				var newDialog = dialogScript.Serialize();
				if(newDialog.indexOf("\n") > -1) {
					newDialog = '"""\n' + newDialog + '\n"""';
				}
				dialog[dlgId] = newDialog;
			}
		}

		{
			var titleScript = scriptInterpreter.Parse( title );
			var visitor = new PrintFunctionVisitor();
			titleScript.VisitAll( visitor );
			if( visitor.DidChange() ) {
				title = titleScript.Serialize();
			}
		}
	}
}

function on_game_data_change_core() {
	console.log(document.getElementById("game_data").value);

	clearGameData();
	var version = parseWorld(document.getElementById("game_data").value); //reparse world if user directly manipulates game data

	convertGameDataToCurVersion(version);

	console.log(paintTool.GetCurDrawing());

	// TODO : fallback if there are no tiles, sprites, map

	// TODO RENDERER : refresh images

	roomTool.drawEditMap();

	paintTool.reloadDrawing();

	// if user pasted in a custom font into game data - update the stored custom font
	if (defaultFonts.indexOf(fontName + fontManager.GetExtension()) == -1) {
		var fontStorage = {
			name : fontName,
			fontdata : fontManager.GetData(fontName)
		};
		localStorage.custom_font = JSON.stringify(fontStorage);
	}

	updateInventoryUI();

	updateFontSelectUI();

	markerTool.SetRoom(curRoom);

	updateTitleTextBox(title);

	// TODO -- start using this for more things
	events.Raise("game_data_change");
}

function updateFontSelectUI() {
	var fontStorage = null;
	if (localStorage.custom_font != null) {
		fontStorage = JSON.parse(localStorage.custom_font);
	}

	var fontSelect = document.getElementById("fontSelect");

	for (var i in fontSelect.options) {
		var fontOption = fontSelect.options[i];
		var fontOptionName = (fontOption.value === "custom" && fontStorage != null) ? fontStorage.name : fontOption.value;
		fontOption.selected = fontOptionName === fontName;

		if (fontOption.value === "custom" && fontStorage != null) {
			var textSplit = fontOption.text.split("-");
			fontOption.text = textSplit[0] + "- " + fontStorage.name;
		}
	}

	updateFontDescriptionUI();
	updateTextDirectionSelectUI(); // a bit hacky but probably ok?
	updateEditorTextDirection(textDirection); // EXTREMELY hack :(
}

function updateFontDescriptionUI() {
	for (var i in fontSelect.options) {
		var fontOption = fontSelect.options[i];
		var fontDescriptionId = fontOption.value + "_description";
		// console.log(fontDescriptionId);
		var fontDescription = document.getElementById(fontDescriptionId);
		if (fontDescription != null) {
			fontDescription.style.display = fontOption.selected ? "block" : "none";
		}
	}
}

function updateExitOptionsFromGameData() {
	// TODO ???
}

function on_toggle_wall(e) {
	paintTool.toggleWall( e.target.checked );
}

function toggleWallUI(checked) {
	document.getElementById("wallCheckboxIcon").innerHTML = checked ? "border_outer" : "border_clear";
}

function filenameFromGameTitle() {
	var filename = title.replace(/[^a-zA-Z]/g, "_"); // replace non alphabet characters
	filename = filename.toLowerCase();
	filename = filename.substring(0,32); // keep it from getting too long
	return filename;
}

function exportGame() {
	refreshGameData(); //just in case
	// var gameData = document.getElementById("game_data").value; //grab game data
	var gameData = getFullGameData();
	var size = document.getElementById("exportSizeFixedInput").value;
	exporter.exportGame( gameData, title, export_settings.page_color, filenameFromGameTitle() + ".html", isFixedSize, size ); //download as html file
}

function exportGameData() {
	refreshGameData(); //just in case
	// var gameData = document.getElementById("game_data").value; //grab game data
	var gameData = getFullGameData();
	ExporterUtils.DownloadFile( filenameFromGameTitle() + ".bitsy", gameData );
}

function exportFont() {
	var fontData = fontManager.GetData(fontName);
	ExporterUtils.DownloadFile( fontName + ".bitsyfont", fontData );
}

function hideAbout() {
	document.getElementById("aboutPanel").setAttribute("style","display:none;");
}

function toggleInstructions(e) {
	var div = document.getElementById("instructions");
	if (e.target.checked) {
		div.style.display = "block";
	}
	else {
		div.style.display = "none";
	}
	document.getElementById("instructionsCheckIcon").innerHTML = e.target.checked ? "expand_more" : "expand_less";
}

//todo abstract this function into toggleDiv
function toggleVersionNotes(e) {
	var div = document.getElementById("versionNotes");
	if (e.target.checked) {
		div.style.display = "block";
	}
	else {
		div.style.display = "none";
	}
	document.getElementById("versionNotesCheckIcon").innerHTML = e.target.checked ? "expand_more" : "expand_less";
}

/* MARKERS (exits & endings) */
var markerTool;

function newExit() {
	markerTool.AddExit();
	roomTool.drawEditMap();
}

function newEnding() {
	markerTool.AddEnding();
	roomTool.drawEditMap();
}

function newEffect() {
	markerTool.AddEffect();
	roomTool.drawEditMap();
}

function deleteMarker() {
	markerTool.RemoveMarker();
	roomTool.drawEditMap();
}

function prevMarker() {
	markerTool.NextMarker();
	roomTool.drawEditMap();
}

function nextMarker() {
	markerTool.PrevMarker();
	roomTool.drawEditMap();
}

function toggleMoveMarker1(e) {
	markerTool.TogglePlacingFirstMarker(e.target.checked);
}

function cancelMoveMarker1() {
	markerTool.TogglePlacingFirstMarker(false);
}

function selectMarkerRoom1() {
	markerTool.SelectMarkerRoom1();
}

function toggleMoveMarker2(e) {
	markerTool.TogglePlacingSecondMarker(e.target.checked);
}

function cancelMoveMarker2() {
	markerTool.TogglePlacingSecondMarker(false);
}

function selectMarkerRoom2() {
	markerTool.SelectMarkerRoom2();
}

function changeExitDirection() {
	markerTool.ChangeExitLink();
	roomTool.drawEditMap();
}

function onEndingTextChange(event) {
	markerTool.ChangeEndingText(event.target.value);
}

function onEffectTextChange(event) {
	markerTool.ChangeEffectText(event.target.value);
}

function showMarkers() {
	toggleRoomMarkers(true);
}

function hideMarkers() {
	toggleRoomMarkers(false);
}

function toggleRoomMarkers(visible) {
	if (visible) {
		markerTool.Refresh();
	}
	roomTool.areMarkersVisible = visible;
	roomTool.drawEditMap();
	document.getElementById("roomMarkersCheck").checked = visible;
	document.getElementById("roomMarkersIcon").innerHTML = visible ? "visibility" : "visibility_off";
}

function onToggleExitOptions() {
	markerTool.SetExitOptionsVisibility(document.getElementById("showExitOptionsCheck").checked);
}

function onChangeExitOptionsSelect(exitSelectId) {
	markerTool.UpdateExitOptions(exitSelectId);
}

function onChangeExitTransitionEffect(effectId) {
	markerTool.ChangeExitTransitionEffect(effectId);
}

// TODO : put helper method somewhere more.. helpful
function setElementClass(elementId, classId, addClass) {
	var el = document.getElementById(elementId);
	if (addClass) {
		el.classList.add(classId);
	}
	else {
		el.classList.remove(classId);
	}
	console.log(el.classList);
}

function togglePanelAnimated(e) {
	var panel = document.getElementById(e.target.value);
	if (e.target.checked) {
		togglePanel(e);
		panel.classList.add("drop");
		setTimeout( function() { panel.classList.remove("drop"); }, 300 );
	}
	else {
		panel.classList.add("close");
		setTimeout(
			function() {
				togglePanel(e);
				panel.classList.remove("close");
			},
			400
		);
	}
}

function togglePanel(e) {
	togglePanelCore( e.target.value, e.target.checked );
}

function showPanel(id) {
	togglePanelCore( id, true /*visible*/ );
}

function hidePanel(id) {
	// animate panel and tools button
	document.getElementById(id).classList.add("close");
	document.getElementById("toolsCheckLabel").classList.add("flash");

	setTimeout(
		function() {
			// close panel after animations
			togglePanelCore( id, false /*visible*/ );

			// reset animations
			document.getElementById(id).classList.remove("close");
			document.getElementById("toolsCheckLabel").classList.remove("flash");
		},
		400
	);
}

function togglePanelCore(id,visible,doUpdatePrefs=true) {
	//hide/show panel
	togglePanelUI( id, visible );
	//any side effects
	afterTogglePanel( id, visible );
	//save panel preferences
	// savePanelPref( id, visible );
	if(doUpdatePrefs) {
		updatePanelPrefs();
	}
}

function togglePanelUI(id,visible) {
	if( visible ) {
		var editorContent = document.getElementById("editorContent");
		var cardElement = document.getElementById(id);
		editorContent.appendChild(cardElement);
	}

	document.getElementById(id).style.display = visible ? "inline-block" : "none";

	if (visible) {
		cardElement.scrollIntoView();
	}

	// update checkbox
	if (id != "toolsPanel") {
		document.getElementById(id.replace("Panel","Check")).checked = visible;
	}
}

function afterTogglePanel(id,visible) {
	if (visible) {
		afterShowPanel(id);
	}
	else {
		afterHidePanel(id);
	}
}

function afterShowPanel(id) {
	if (id === "exitsPanel") {
		showMarkers();
	}
}

function afterHidePanel(id) {
	if (id === "exitsPanel") {
		hideMarkers();
	}
}

// DEPRECATED
function savePanelPref(id,visible) {
	var prefs = localStorage.panel_prefs == null ? {} : JSON.parse( localStorage.panel_prefs );
	prefs[id] = visible;
	localStorage.setItem( "panel_prefs", JSON.stringify(prefs) );
}

function updatePanelPrefs() {
	// console.log("UPDATE PREFS");

	var prefs = getPanelPrefs();
	// console.log(prefs);

	var editorContent = document.getElementById("editorContent");
	var cards = editorContent.getElementsByClassName("panel");

	for(var i = 0; i < cards.length; i++) {
		var card = cards[i];
		var id = card.id;
		var visible = card.style.display != "none";

		for (var j = 0; j < prefs.workspace.length; j++ )
		{
			if (prefs.workspace[j].id === id) {
				prefs.workspace[j].position = i;
				prefs.workspace[j].visible = visible;
			}
		}
	}

	// console.log(prefs);
	localStorage.panel_prefs = JSON.stringify( prefs );
	// console.log(localStorage.panel_prefs);
}


var gifRecordingInterval = null;
function startRecordingGif() {
	gifFrameData = [];

	document.getElementById("gifStartButton").style.display="none";
	document.getElementById("gifSnapshotButton").style.display="none";
	document.getElementById("gifStopButton").style.display="inline";
	document.getElementById("gifRecordingText").style.display="inline";
	document.getElementById("gifPreview").style.display="none";
	document.getElementById("gifPlaceholder").style.display="block";

	gifRecordingInterval = setInterval( function() {
		gifFrameData.push( ctx.getImageData(0,0,512,512).data );
	}, 100 );
}

var gifCaptureCanvas; // initialized in start() -- should be in own module?
var gifCaptureCtx;
var gifCaptureWidescreenSize = {
	width : 726, // height * 1.26
	height : 576
};

function takeSnapshotGif(e) {
	var gif = {
		frames: [],
		width: 512,
		height: 512,
		loops: 0,
		delay: animationTime / 10
	};

	gifCaptureCanvas.width = 512; // stop hardcoding 512?
	gifCaptureCanvas.height = 512;

	drawRoom( room[curRoom], true, gifCaptureCtx, 0 );
	var frame0 = gifCaptureCtx.getImageData(0,0,512,512);

	drawRoom( room[curRoom], true, gifCaptureCtx, 1 );
	var frame1 = gifCaptureCtx.getImageData(0,0,512,512);

	if(e.altKey) {
		/* widescreen */
		gif.width = gifCaptureWidescreenSize.width;
		gif.height = gifCaptureWidescreenSize.height;
		gifCaptureCanvas.width = gifCaptureWidescreenSize.width;
		gifCaptureCanvas.height = gifCaptureWidescreenSize.height;

		var widescreenX = (gifCaptureWidescreenSize.width / 2) - (512 / 2);
		var widescreenY = (gifCaptureWidescreenSize.height / 2) - (512 / 2);

		gifCaptureCtx.fillStyle = "rgb(" + getPal(curPal())[0][0] + "," + getPal(curPal())[0][1] + "," + getPal(curPal())[0][2] + ")";
		gifCaptureCtx.fillRect(0,0,gifCaptureWidescreenSize.width,gifCaptureWidescreenSize.height);

		gifCaptureCtx.putImageData(frame0,widescreenX,widescreenY);
		frame0 = gifCaptureCtx.getImageData(0,0,gifCaptureWidescreenSize.width,gifCaptureWidescreenSize.height);

		gifCaptureCtx.putImageData(frame1,widescreenX,widescreenY);
		frame1 = gifCaptureCtx.getImageData(0,0,gifCaptureWidescreenSize.width,gifCaptureWidescreenSize.height);
	}

	gif.frames.push( frame0.data );
	gif.frames.push( frame1.data );

	finishRecordingGif(gif);
}

function stopRecordingGif() {
	var gif = {
		frames: gifFrameData,
		width: 512,
		height: 512,
		loops: 0,
		delay: 10
	};

	finishRecordingGif(gif);
}

// TODO - palette for rainbow text
function finishRecordingGif(gif) {
	if(gifRecordingInterval != null) {
		clearInterval( gifRecordingInterval );
		gifRecordingInterval = null;
	}

	document.getElementById("gifStartButton").style.display="none";
	document.getElementById("gifSnapshotButton").style.display="none";
	document.getElementById("gifStopButton").style.display="none";
	document.getElementById("gifRecordingText").style.display="none";
	document.getElementById("gifEncodingText").style.display="inline";
	document.getElementById("gifEncodingProgress").innerText = "0";

	if(gif.frames.length <= 0) {
		document.getElementById("gifEncodingText").style.display="none";
		document.getElementById("gifStartButton").style.display="inline";
		return; // nothing recorded, nothing to encode
	}

	setTimeout( function() {
		var hexPalette = [];
		// add black & white
		hexPalette.push( rgbToHex(0,0,0).slice(1) ); // need to slice off leading # (should that safeguard go in gif.js?)
		hexPalette.push( rgbToHex(255,255,255).slice(1) );
		// add all user defined palette colors
		for (id in palette) {
			for (i in getPal(id)){
				var hexStr = rgbToHex( getPal(id)[i][0], getPal(id)[i][1], getPal(id)[i][2] ).slice(1);
				hexPalette.push( hexStr );
			}
		}
		// add rainbow colors (for rainbow text effect)
		hexPalette.push( hslToHex(0.0,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.1,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.2,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.3,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.4,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.5,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.6,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.7,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.8,1,0.5).slice(1) );
		hexPalette.push( hslToHex(0.9,1,0.5).slice(1) );

		gif.palette = hexPalette; // hacky

		gifencoder.encode( gif, 
			function(uri, blob) {
				document.getElementById("gifEncodingText").style.display="none";
				document.getElementById("gifStartButton").style.display="inline";
				document.getElementById("gifPreview").src = uri;
				document.getElementById("gifPreview").style.display="block";
				document.getElementById("gifPlaceholder").style.display="none";
				document.getElementById("gifSnapshotButton").style.display="inline";

				if( browserFeatures.blobURL ) {
					document.getElementById("gifDownload").href = makeURL.createObjectURL( blob );
				}
				else {
					var downloadData = uri.replace("data:;", "data:attachment/file;"); // for safari
					document.getElementById("gifDownload").href = downloadData;
				}
			},
			function(curFrame, maxFrame) {
				document.getElementById("gifEncodingProgress").innerText = Math.floor( (curFrame / maxFrame) * 100 );
			}
		);
	}, 10);
}

/* LOAD FROM FILE */
function importGameFromFile(e) {
	resetGameData();

	console.log("IMPORT START");

	// load file chosen by user
	var files = e.target.files;
	var file = files[0];
	var reader = new FileReader();
	reader.readAsText( file );

	reader.onloadend = function() {
		var fileText = reader.result;
		gameDataStr = exporter.importGame( fileText );

		console.log("import load end");
		// console.log(gameDataStr);
		
		// change game data & reload everything
		document.getElementById("game_data").value = gameDataStr;
		on_game_data_change();

		paintExplorer.Refresh(drawing.type);
	}
}

function importFontFromFile(e) {
	// load file chosen by user
	var files = e.target.files;
	var file = files[0];
	var reader = new FileReader();
	reader.readAsText( file );

	reader.onloadend = function() {
		var fileText = reader.result;
		console.log(fileText);

		var customFontName = (fontManager.Create(fileText)).getName();

		fontManager.AddResource(customFontName + fontManager.GetExtension(), fileText);
		switchFont(customFontName); // bitsy engine setting

		var fontStorage = {
			name : customFontName,
			fontdata : fileText
		};
		localStorage.custom_font = JSON.stringify(fontStorage);

		refreshGameData();
		updateFontSelectUI();

		// TODO
		// fontLoadSettings.resources.set("custom.txt", fileText); // hacky!!!
	}
}

/* ANIMATION EDITING*/
function on_toggle_animated(e) {
	paintTool.toggleAnimated(e.target.checked);
}

function on_paint_frame1() {
	// TODO .. combine into one function
	paintTool.curDrawingFrameIndex = 0;
	paintTool.reloadDrawing();
}

function on_paint_frame2() {
	paintTool.curDrawingFrameIndex = 1;
	paintTool.reloadDrawing();
}

var export_settings = {
	page_color : "#ffffff"
};

function on_change_color_page() {
	var hex = document.getElementById("pageColor").value;
	//console.log(hex);
	var rgb = hexToRgb( hex );
	// document.body.style.background = hex;
	document.getElementById("roomPanel").style.background = hex;
	export_settings.page_color = hex;

	localStorage.export_settings = JSON.stringify( export_settings );
}

function getComplimentingColor(palId) {
	if (!palId) palId = curPal();
	var hsl = rgbToHsl( getPal(palId)[0][0], getPal(palId)[0][1], getPal(palId)[0][2] );
	// console.log(hsl);
	var lightness = hsl[2];
	if (lightness > 0.5) {
		return "#fff";
	}
	else {
		return "#000";
	}
}

/* MOVEABLE PANESL */
var grabbedPanel = {
	card: null,
	size: 0,
	cursorOffset: {x:0,y:0},
	shadow: null
};

function grabCard(e) {
	// can't grab cards in vertical mode right now
	if (window.innerHeight > window.innerWidth) { // TODO : change to portrait orientation check??
		return;
	}

	// e.preventDefault();

	console.log("--- GRAB START");
	console.log(grabbedPanel.card);

	if (grabbedPanel.card != null) return;

	grabbedPanel.card = e.target;
	while(!grabbedPanel.card.classList.contains("panel") && !(grabbedPanel.card == null)) {
		grabbedPanel.card = grabbedPanel.card.parentElement;
	}

	if(grabbedPanel.card == null) return; // couldn't find a panel above the handle - abort!

	console.log(grabbedPanel.card);
	console.log("--")

	grabbedPanel.size = getElementSize( grabbedPanel.card );
	var pos = getElementPosition( grabbedPanel.card );
	
	grabbedPanel.shadow = document.createElement("div");
	grabbedPanel.shadow.className = "panelShadow";
	grabbedPanel.shadow.style.width = grabbedPanel.size.x + "px";
	grabbedPanel.shadow.style.height = grabbedPanel.size.y + "px";

	console.log( document.getElementById("editorContent") );
	console.log( grabbedPanel.shadow );
	console.log( grabbedPanel.card );

	document.getElementById("editorContent").insertBefore( grabbedPanel.shadow, grabbedPanel.card );
	grabbedPanel.cursorOffset.x = e.clientX - pos.x;
	grabbedPanel.cursorOffset.y = e.clientY - pos.y;
	console.log("client " + e.clientX);
	console.log("card " + pos.x);
	console.log("offset " + grabbedPanel.cursorOffset.x);
	// console.log("screen " + e.screenX);
	grabbedPanel.card.style.position = "absolute";
	grabbedPanel.card.style.left = e.clientX - grabbedPanel.cursorOffset.x + "px";
	grabbedPanel.card.style.top = e.clientY - grabbedPanel.cursorOffset.y + "px";
	grabbedPanel.card.style.zIndex = 1000;
}

function panel_onMouseMove(e) {
	if (grabbedPanel.card == null) return;

	console.log("-- PANEL MOVE");
	console.log(grabbedPanel.card);

	grabbedPanel.card.style.left = e.clientX - grabbedPanel.cursorOffset.x + "px";
	grabbedPanel.card.style.top = e.clientY - grabbedPanel.cursorOffset.y + "px";

	var cardPos = getElementPosition( grabbedPanel.card );
	var cardSize = grabbedPanel.size;
	var cardCenter = { x:cardPos.x+cardSize.x/2, y:cardPos.y+cardSize.y/2 };

	console.log(cardCenter);

	var editorContent = document.getElementById("editorContent");
	var editorContentWidth = editorContent.getBoundingClientRect().width;
	var otherCards = editorContent.getElementsByClassName("panel");

	// var cardCollection = editorContent.getElementsByClassName("panel");
	// var otherCards = [];
	// for (var i = 0; i < cardCollection.length; i++) {
	// 	otherCards.push(cardCollection[i]);
	// }
	// // console.log(otherCards);

	// // hacky fix for arabic -- need better solution
	// if (curEditorLanguageCode === "ar") {
	// 	// otherCards.reverse();
	// 	cardCenter.x = editorContentWidth - cardCenter.x;
	// }

	// console.log(cardCenter);
	// console.log("---");

	for(var j = 0; j < otherCards.length; j++) {
		var other = otherCards[j];
		// console.log(other);
		var otherPos = getElementPosition( other );
		var otherSize = getElementSize( other );
		var otherCenter = { x:otherPos.x+otherSize.x/2, y:otherPos.y+otherSize.y/2 };

		// console.log(otherCenter);

		if ( cardCenter.x < otherCenter.x ) {
			console.log("INSERT " + cardCenter.x + " " + otherCenter.x);
			console.log(other);

			editorContent.insertBefore( grabbedPanel.shadow, other );
			break;
		}
		else if (j == otherCards.length - 1 && cardCenter.x > otherCenter.x) {
			editorContent.appendChild( grabbedPanel.shadow );
			break;
		}
	}

	console.log("********")
}
document.addEventListener("mousemove",panel_onMouseMove);

function panel_onMouseUp(e) {
	if (grabbedPanel.card == null) return;

	var editorContent = document.getElementById("editorContent");
	editorContent.insertBefore( grabbedPanel.card, grabbedPanel.shadow );
	editorContent.removeChild( grabbedPanel.shadow );
	grabbedPanel.card.style.position = "relative";
	grabbedPanel.card.style.top = null;
	grabbedPanel.card.style.left = null;
	grabbedPanel.card.style.zIndex = null;

	// drop card anim
	var cardTmp = grabbedPanel.card;
	cardTmp.classList.add("drop");
	setTimeout( function() { cardTmp.classList.remove("drop"); }, 300 );

	grabbedPanel.card = null;

	updatePanelPrefs();
}
document.addEventListener("mouseup",panel_onMouseUp);

// TODO consolidate these into one function?
function getElementPosition(e) { /* gets absolute position on page */
	if (!e.getBoundingClientRect) {
		console.log("NOOO BOUNDING RECT!!!");
		return {x:0,y:0};
	}

	var rect = e.getBoundingClientRect();
	var pos = {x:rect.left,y:rect.top};
	// console.log(pos);
	return pos;
}

function getElementSize(e) { /* gets visible size */
	return {
		x: e.clientWidth,
		y: e.clientHeight
	};
}

// sort of a hack to avoid accidentally activating backpage and nextpage while scrolling through editor panels 
function blockScrollBackpage(e) {
	var el = document.getElementById("editorWindow");
	var maxX = el.scrollWidth - el.offsetWidth;

	// if ( el.scrollLeft + e.deltaX < 0 || el.scrollLeft + e.deltaX > maxX )
	// {
	// 	e.preventDefault();
	// 	el.scrollLeft = Math.max(0, Math.min(maxX, el.scrollLeft + event.deltaX));
	// }
}

function toggleDialogCode(e) {
	console.log("DIALOG CODE");
	console.log(e.target.checked);
	if (e.target.checked) {
		showDialogCode();
	}
	else {
		hideDialogCode();
	}
}

function showDialogCode() {
	document.getElementById("dialogCode").style.display = "block";
	document.getElementById("dialogEditor").style.display = "none";
	// document.getElementById("dialogShowCode").style.display = "none";
	// document.getElementById("dialogHideCode").style.display = "block";
	document.getElementById("dialogTools").style.display = "none";

	document.getElementById("dialogToggleCodeShowText").style.display = "none";
	document.getElementById("dialogToggleCodeHideText").style.display = "inline";
}

function hideDialogCode() {
	document.getElementById("dialogCode").style.display = "none";
	document.getElementById("dialogEditor").style.display = "block";
	// document.getElementById("dialogShowCode").style.display = "block";
	// document.getElementById("dialogHideCode").style.display = "none";
	document.getElementById("dialogTools").style.display = "block";

	document.getElementById("dialogToggleCodeShowText").style.display = "inline";
	document.getElementById("dialogToggleCodeHideText").style.display = "none";
}

function showDialogToolsSection() {
	document.getElementById("dialogToolsSection").style.display = "block";
	document.getElementById("dialogToolsEffects").style.display = "none";
}

function showDialogToolsEffects() {
	document.getElementById("dialogToolsSection").style.display = "none";
	document.getElementById("dialogToolsEffects").style.display = "block";
}

function showInventoryItem() {
	document.getElementById("inventoryItem").style.display = "block";
	document.getElementById("inventoryVariable").style.display = "none";
}

function showInventoryVariable() {
	document.getElementById("inventoryItem").style.display = "none";
	document.getElementById("inventoryVariable").style.display = "block";
}

var isPreviewDialogMode = false;
var previewDialogScriptTree = null;
function togglePreviewDialog(event) {
	console.log("TOGGLE PREVIEW " + event.target.checked);
	if(event.target.checked) {
		isPreviewDialogMode = true;
		console.log(isPreviewDialogMode);

		if(previewDialogScriptTree != null) {
			if (document.getElementById("roomPanel").style.display === "none")
				showPanel("roomPanel");

			console.log("PLAY MODE");
			on_play_mode();
		
			startPreviewDialog( previewDialogScriptTree, function() {
				console.log("CALLBACK!!!");
				togglePreviewDialog( { target : { checked : false } } );
			});
		}
	}
	else {
		on_edit_mode();
		isPreviewDialogMode = false;
	}
	updatePlayModeButton();
	updatePreviewDialogButton();
}

var isFixedSize = false;
function chooseExportSizeFull() {
	isFixedSize = false;
	document.getElementById("exportSizeFixedInputSpan").style.display = "none";
}

function chooseExportSizeFixed() {
	isFixedSize = true;
	document.getElementById("exportSizeFixedInputSpan").style.display = "inline-block";
}

// LOCALIZATION
var localization;
function on_change_language(e) {
	var language = e.target.value;
	pickDefaultFontForLanguage(language);
	on_change_language_inner(language);
}

function on_change_language_inner(language) {
	changeLnaguageStyle(language); // TODO : misspelled funciton name

	localization.ChangeLanguage(language);
	updateInventoryUI();
	// reloadDialogUI(); // TODO : replace with action refresh?
	hackyUpdatePlaceholderText();

	// update title in new language IF the user hasn't made any changes to the default title
	if (localization.LocalizationContains("default_title", title)) {
		title = localization.GetStringOrFallback("default_title", "Write your game's title here");
		updateTitleTextBox(title);
	}

	// update default sprite
	var defaultSpriteDlgExists = dialog["SPR_0"] != null && localization.LocalizationContains("default_sprite_dlg", dialog["SPR_0"]);
	if (defaultSpriteDlgExists) {
		dialog["SPR_0"] = localization.GetStringOrFallback("default_sprite_dlg", "I'm a cat");
		paintTool.reloadDrawing();
	}

	// update default item
	var defaultItemDlgExists = dialog["ITM_0"] != null && localization.LocalizationContains("default_item_dlg", dialog["ITM_0"]);
	if (defaultItemDlgExists) {
		dialog["ITM_0"] = localization.GetStringOrFallback("default_item_dlg", "You found a nice warm cup of tea");
		paintTool.reloadDrawing(); // hacky to do this twice
	}

	refreshGameData();
}

// TODO : create a system for placeholder text like I have for innerText
function hackyUpdatePlaceholderText() {
	var titlePlaceholder = localization.GetStringOrFallback("title_placeholder", "Title");
	var titleTextBoxes = document.getElementsByClassName("titleTextBox");
	for (var i = 0; i < titleTextBoxes.length; i++) {
		titleTextBoxes[i].placeholder = titlePlaceholder;
	}

	var filterPlaceholder = localization.GetStringOrFallback("filter_placeholder", "filter drawings");
	document.getElementById("paintExplorerFilterInput").placeholder = filterPlaceholder;
}

var curEditorLanguageCode = "en";
function changeLnaguageStyle(newCode) { // TODO : fix function name
	document.body.classList.remove("lang_" + curEditorLanguageCode);
	curEditorLanguageCode = newCode;
	document.body.classList.add("lang_" + curEditorLanguageCode);
}

function pickDefaultFontForLanguage(lang) {
	// TODO : switch to asian characters when we get asian language translations of editor
	if (lang === "en") {
		switchFont("ascii_small", true /*doPickTextDirection*/);
	}
	else if (lang === "ar") {
		switchFont("arabic", true /*doPickTextDirection*/);
	}
	else if (lang === "zh") {
		switchFont("unicode_asian", true /*doPickTextDirection*/);
	}
	else {
		switchFont("unicode_european_small", true /*doPickTextDirection*/);
	}
	updateFontSelectUI();
	resetMissingCharacterWarning();
}

function on_change_font(e) {
	if (e.target.value != "custom") {
		switchFont(e.target.value, true /*doPickTextDirection*/);
	}
	else {
		if (localStorage.custom_font != null) {
			var fontStorage = JSON.parse(localStorage.custom_font);
			switchFont(fontStorage.name, true /*doPickTextDirection*/);
		}
		else {
			// fallback
			switchFont("ascii_small", true /*doPickTextDirection*/);
		}
	}
	updateFontDescriptionUI();
	// updateEditorTextDirection();
	resetMissingCharacterWarning();
}

function switchFont(newFontName, doPickTextDirection) {
	if (doPickTextDirection === undefined || doPickTextDirection === null) {
		doPickTextDirection = false;
	}

	fontName = newFontName;

	if (doPickTextDirection) {
		console.log("PICK TEXT DIR");
		pickDefaultTextDirectionForFont(newFontName);
	}

	refreshGameData()
}

function initLanguageOptions() {
	localization.Localize();

	var languageSelect = document.getElementById("languageSelect");
	languageSelect.innerHTML = "";

	var languageList = localization.GetLanguageList();
	for (var i = 0; i < languageList.length; i++) {
		var option = document.createElement("option");
		option.innerText = languageList[i].name;
		option.value = languageList[i].id;
		option.selected = languageList[i].id === localization.GetLanguage();
		languageSelect.add(option);
	}

	// is this doing duplicate work??
	on_change_language_inner( localization.GetLanguage() );
}

function on_change_text_direction(e) {
	console.log("CHANGE TEXT DIR " + e.target.value);
	updateEditorTextDirection(e.target.value);
	refreshGameData();
}

function pickDefaultTextDirectionForFont(newFontName) {
	var newTextDirection = TextDirection.LeftToRight;
	if (newFontName === "arabic") {
		newTextDirection = TextDirection.RightToLeft;
	}
	updateEditorTextDirection(newTextDirection);
	updateTextDirectionSelectUI();
}

function updateEditorTextDirection(newTextDirection) {
	var prevTextDirection = textDirection;
	textDirection = newTextDirection;

	console.log("TEXT BOX TEXT DIR " + textDirection);

	if (prevTextDirection != null) {
		document.body.classList.remove("dir_" + prevTextDirection.toLowerCase());
	}
	document.body.classList.add("dir_" + textDirection.toLowerCase());
}

function updateTextDirectionSelectUI() {
	var textDirSelect = document.getElementById("textDirectionSelect");
	for (var i in textDirSelect.options) {
		var option = textDirSelect.options[i];
		option.selected = (option.value === textDirection);
	}
}

/* DOCS */
function toggleDialogDocs(e) {
	console.log("SHOW DOCS");
	console.log(e.target.checked);
	if (e.target.checked) {
		document.getElementById("dialogDocs").style.display = "block";
		document.getElementById("dialogToggleDocsShowText").style.display = "none";
		document.getElementById("dialogToggleDocsHideText").style.display = "inline";
	}
	else {
		document.getElementById("dialogDocs").style.display = "none";
		document.getElementById("dialogToggleDocsShowText").style.display = "inline";
		document.getElementById("dialogToggleDocsHideText").style.display = "none";
	}
}

/* WARNINGS */
// TODO : turn this into a real system someday instead of hard-coded nonsense
var missingCharacterWarningState = {
	showedWarning : false,
	curFont : null
}

function resetMissingCharacterWarning() {
	// missingCharacterWarningState.showedWarning = false; // should I really do this every time?
	missingCharacterWarningState.curFont = fontManager.Get( fontName );
}

function tryWarnAboutMissingCharacters(text) {
	if (missingCharacterWarningState.showedWarning) {
		return;
	}

	var hasMissingCharacter = false;

	console.log(missingCharacterWarningState.curFont.getData());

	for (var i = 0; i < text.length; i++) {
		var character = text[i];
		if (!missingCharacterWarningState.curFont.hasChar(character)) {
			hasMissingCharacter = true;
		}
	}

	if (hasMissingCharacter) {
		showFontMissingCharacterWarning();
	}
}

function showFontMissingCharacterWarning() {
	document.getElementById("fontMissingCharacter").style.display = "block";
	missingCharacterWarningState.showedWarning = true;
}

function hideFontMissingCharacterWarning() {
	document.getElementById("fontMissingCharacter").style.display = "none";
}

/* OBJECT ACTION CONTROLS */
function prevObjectAction() {
	paintTool.selectPrevAction();
}

function nextObjectAction() {
	paintTool.selectNextAction();
}

function openObjectAction() {
	paintTool.openCurrentActionInEditor();
}

function toggleObjectActionView() {
	paintTool.toggleActionView();
}

function newObjectAction() {
	paintTool.newAction();
}