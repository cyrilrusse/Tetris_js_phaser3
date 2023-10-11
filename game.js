var player = {
	username: null,
};

window.addEventListener('message', (event) => {
	if (event.data) player.username = event.data.username;

	getPB();
});

function getPB() {
	if (player.username != null) {
		fetch(
			'https://europe-west1.gcp.data.mongodb-api.com/app/application-0-ptcis/endpoint/getPB',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: 'Tetris',
					username: player.username,
				}),
			}
		)
			.then((response) => {
				if (response.ok) return response.json();
			})
			.then((data) => {
				player.pb = data.score;
			})
			.catch((err) => {
				console.log('Error while get pb request : ', err);
			});
	}
}

/*----- VARIABLES -----*/
// Positions variables
const squareSize = 32;
const gridWidth = 10;
const gridHeight = 20;
const centerInfoPanel = 480;

//Datas
const tetriminos = {
	I: [[1, 1, 1, 1]],
	Z: [
		[1, 1, 0],
		[0, 1, 1],
	],
	S: [
		[0, 1, 1],
		[1, 1, 0],
	],
	O: [
		[1, 1],
		[1, 1],
	],
	T: [
		[0, 1, 0],
		[1, 1, 1],
	],
	L: [
		[0, 0, 1],
		[1, 1, 1],
	],
	J: [
		[1, 0, 0],
		[1, 1, 1],
	],
};

var keys = {
	keydownLeft: false,
	keydownRight: false,
	keydownUp: false,
	keydownDown: false,
	keydownSpace: false,
	keydownP: false,
	keydownN: false,
};

var text_clear = ['SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS', 'COMBO', 'ALL CLEAR'];

var keys_list = {};

const lvl_speed = [
	{ lvl: 1, interval: 48 },
	{ lvl: 1, interval: 43 },
	{ lvl: 1, interval: 38 },
	{ lvl: 1, interval: 33 },
	{ lvl: 1, interval: 28 },
	{ lvl: 1, interval: 23 },
	{ lvl: 1, interval: 18 },
	{ lvl: 1, interval: 13 },
	{ lvl: 1, interval: 8 },
	{ lvl: 1, interval: 6 },
	{ lvl: 3, interval: 5 },
	{ lvl: 3, interval: 4 },
	{ lvl: 3, interval: 3 },
	{ lvl: 10, interval: 2 },
	{ lvl: 10, interval: 1 },
];

const NUMBER_OF_LINES_PER_LVL = 10;

//Pieces
var currentPiece;
var grid = [];
var landed = false;
var nextPiece = {};

//Score
var combo = 0;
var nbr_of_lines_cleared = 0;
var score = 0;

//Lvls and speed
var lvl = 0;
var efficient_lvl = 0;
var lvl_since_last_increase = 0;
var nbr_lines_since_last_lvl = 0;
var timer;

//Font and display
const style = { font: 'bold 22px Arial', fill: '#fff', align: 'center' };
const style_combo = {
	font: 'bold 35px Arial',
	fill: '#fff',
	align: 'center',
	backgroundColor: '#000',
};
var text_next;
var text_score;
var text_lvl;
var text_lines;
var text_combo;
var text_pause;
var text_game_over;
var text_key_pause;
var text_key_new_game;
var text_pb;

/*----- INIT GAME -----*/
var gameOver = false;
var pause = false;
var config = {
	type: Phaser.AUTO,
	width: 19 * squareSize,
	height: 22 * squareSize,
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 0 },
			debug: false,
		},
	},
	scene: {
		preload: preload,
		create: create,
		update: update,
	},
};
var game = new Phaser.Game(config);

//Preload
function preload() {
	//Load map
	this.load.image('tiles', 'Assets/Board/Tilemap32x32.png');
	this.load.tilemapTiledJSON('map', 'map.json');

	//load sprites
	this.load.image('I', 'Assets/Shapes/I.png');
	this.load.image('L', 'Assets/Shapes/L.png');
	this.load.image('J', 'Assets/Shapes/J.png');
	this.load.image('O', 'Assets/Shapes/O.png');
	this.load.image('S', 'Assets/Shapes/S.png');
	this.load.image('T', 'Assets/Shapes/T.png');
	this.load.image('Z', 'Assets/Shapes/Z.png');
}

//Create
function create() {
	//Create Board from json file
	const map = this.make.tilemap({ key: 'map' });
	const tileset = map.addTilesetImage('Tilemap', 'tiles');
	var layerBackground = map.createStaticLayer('Background', tileset);

	//init screen infos
	initDisplayTexts(this);

	//Create Grid
	for (var i = 0; i < gridHeight; i++) {
		grid[i] = [];
		for (var j = 0; j < gridWidth; j++) grid[i][j] = null;
	}

	//Create first piece
	createNextPiece(this);
	currentPiece = createPiece(this);

	//  Input Events init
	cursors = this.input.keyboard.createCursorKeys();
	keys_list.pKey = this.input.keyboard.addKey(
		Phaser.Input.Keyboard.KeyCodes.P
	);
	keys_list.nKey = this.input.keyboard.addKey(
		Phaser.Input.Keyboard.KeyCodes.N
	);

	// Create event with timer to make piece fall
	timer = this.time.addEvent({
		delay: (lvl_speed[efficient_lvl].interval / 60) * 1000,
		callback: dropPiece,
		callbackScope: this,
		loop: true,
	});
}

//Update
function update() {
	//Inputs handler
	inputsHandler(this);

	// game running check
	if (gameOver) return;

	//Create new piece if previous one is landed
	if (landed) {
		setPieceOnGrid(this);
		currentPiece = createPiece(this);
		if (collisionY()) {
			gameOver = true;
			displayGameOver(this, true);
			updatePB(this);
			timer.remove(false);
		}
		landed = false;
	}

	//Screen infos
	displayTexts(this);
}

/*----- Functions -----*/

//Infos
function initDisplayTexts(scene) {
	//score
	text_score = scene.add.text(400, 256, 'Score\n' + score, style);

	//lvl
	text_lvl = scene.add.text(400, 288, 'Level\n' + lvl, style);

	//Lines
	text_lines = scene.add.text(
		464,
		652,
		'Lines\n' + nbr_of_lines_cleared,
		style
	);

	displayNext(scene);
	displayKeysInfo(scene);
	displayPB(scene);
}

function displayTexts(scene) {
	//score
	text_score.destroy();
	text_score = scene.add.text(centerInfoPanel, 256, 'Score\n' + score, style);
	text_score.setOrigin(0.5);

	//lvl
	text_lvl.destroy();
	text_lvl = scene.add.text(centerInfoPanel, 320, 'Level\n' + lvl, style);
	text_lvl.setOrigin(0.5);
	//Lines
	text_lines.destroy();
	text_lines = scene.add.text(
		centerInfoPanel,
		384,
		'Lines\n' + nbr_of_lines_cleared,
		style
	);
	text_lines.setOrigin(0.5);
}

function displayNext(scene) {
	text_next = scene.add.text(
		(gridWidth + 2.2) * squareSize,
		1.1 * squareSize,
		'Next',
		style
	);
}

function displayKeysInfo(scene) {
	text_key_pause = scene.add.text(
		centerInfoPanel,
		(gridHeight - 1) * squareSize,
		'(P)ause',
		style
	);
	text_key_pause.setOrigin(0.5);
	text_key_new_game = scene.add.text(
		centerInfoPanel,
		gridHeight * squareSize,
		'(N)ew Game',
		style
	);
	text_key_new_game.setOrigin(0.5);
}

function displayPause(scene, display) {
	if (display) {
		text_pause = scene.add.text(
			((gridWidth + 2) / 2) * squareSize,
			((gridHeight + 2) / 2) * squareSize,
			' PAUSE ',
			style_combo
		);
		text_pause.setOrigin(0.5);
	} else text_pause.destroy();
}

function displayGameOver(scene, display) {
	if (display) {
		text_game_over = scene.add.text(
			((gridWidth + 2) / 2) * squareSize,
			((gridHeight + 2) / 2) * squareSize,
			' GAME OVER ',
			style_combo
		);
		text_game_over.setOrigin(0.5);
	} else text_game_over.destroy();
}

function dislayCombo(scene, display, nbr_lines, combo) {
	if (text_combo != null) text_combo.destroy();

	if (display) {
		if (isAllClear())
			text_combo = scene.add.text(
				centerInfoPanel,
				480,
				text_clear[5],
				style_combo
			);
		else if (combo == 1)
			text_combo = scene.add.text(
				centerInfoPanel,
				480,
				text_clear[nbr_lines - 1],
				style_combo
			);
		else
			text_combo = scene.add.text(
				centerInfoPanel,
				480,
				text_clear[4] + '\nX' + combo,
				style_combo
			);
	}
	text_combo.setOrigin(0.5);
}

function displayPB(scene) {
	if (!('pb' in player)) return;

	if (text_pb != null) text_pb.destroy();

	text_pb = scene.add.text(
		centerInfoPanel,
		(gridHeight - 2) * squareSize,
		'PB : ' + player.pb,
		style
	);
	text_pb.setOrigin(0.5);
}

function updateScore(nbLines) {
	switch (nbLines) {
		case 1:
			score += 100 * lvl;
			break;
		case 2:
			score += 200 * lvl;
			break;
		case 3:
			score += 500 * lvl;
			break;
		case 4:
			score += 800 * lvl;
			break;
	}
	if (combo > 1) score += 50 * combo * lvl;
}

function updatePB(scene) {
	if ('pb' in player) displayPB(scene);
	if (player.username == null || !('pb' in player) || player.pb >= score)
		return;

	fetch(
		'https://europe-west1.gcp.data.mongodb-api.com/app/application-0-ptcis/endpoint/updateScore',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: 'Tetris',
				username: player.username,
				score: score,
			}),
		}
	)
		.then((response) => {
			if (response.ok) return response.json();
		})
		.then((data) => {
			player.pb = score;
			displayPB(scene);
		})
		.catch((err) => {
			console.log('Error while update pb request : ', err);
		});
}

//Controls
function inputsHandler(scene) {
	//Key N (New Game)
	if (keys_list.nKey.isDown) {
		if (!keys.keydownN) {
			resetGame(scene);
			keys.keydownN = true;
		}
	} else if (keys_list.nKey.isUp) {
		keys.keydownN = false;
	}

	if (gameOver) return;

	//Up Arrow (Rotation)
	if (cursors.up.isDown) {
		if (!keys.keydownUp) {
			rotatePiece(scene);
			keys.keydownUp = true;
		}
	} else if (cursors.up.isUp) {
		keys.keydownUp = false;
	}

	//Down Arrow (soft drop not implemented)
	if (cursors.down.isDown) {
		if (!keys.keydownDown) {
			keys.keydownDown = true;
		}
	} else if (cursors.down.isUp) {
		keys.keydownDown = false;
	}

	//Right Arrow (Right translation)
	if (cursors.right.isDown) {
		if (!keys.keydownRight) {
			translationPiece(1);
			keys.keydownRight = true;
		}
	} else if (cursors.right.isUp) {
		keys.keydownRight = false;
	}

	//Left Arrow (Left translation)
	if (cursors.left.isDown) {
		if (!keys.keydownLeft) {
			translationPiece(-1);
			keys.keydownLeft = true;
		}
	} else if (cursors.left.isUp) {
		keys.keydownLeft = false;
	}

	//Spacebar (Hard drop)
	if (cursors.space.isDown) {
		if (!keys.keydownSpace) {
			hardDrop();
			keys.keydownSpace = true;
		}
	} else if (cursors.space.isUp) {
		keys.keydownSpace = false;
	}

	//Key P (Pause)
	if (keys_list.pKey.isDown) {
		if (!keys.keydownP) {
			if (!gameOver) {
				if (!pause) {
					timer.paused = true;
					displayPause(scene, true);
				} else {
					timer.paused = false;
					displayPause(scene, false);
				}
				pause = !pause;
			}
			keys.keydownP = true;
		}
	} else if (keys_list.pKey.isUp) {
		keys.keydownP = false;
	}
}

function resetGame(scene) {
	combo = 0;
	score = 0;
	nbr_of_lines_cleared = 0;
	lvl = 0;
	efficient_lvl = 0;
	lvl_since_last_increase = 0;
	nbr_lines_since_last_lvl = 0;
	if (gameOver) displayGameOver(this, false);
	gameOver = false;
	destroyAllForReset();
	createNextPiece(scene);
	currentPiece = createPiece(scene);

	timer.remove(false);
	timer = scene.time.addEvent({
		delay: (lvl_speed[efficient_lvl].interval / 60) * 1000,
		callback: dropPiece,
		callbackScope: scene,
		loop: true,
	});
}

function destroyAllForReset() {
	for (var row = 0; row < gridHeight; row++) {
		for (var col = 0; col < gridWidth; col++) {
			if (grid[row][col] != null) {
				grid[row][col].destroy();
				grid[row][col] = null;
			}
		}
	}
	for (var row = 0; row < currentPiece.height; row++) {
		for (var col = 0; col < currentPiece.sprite[row].length; col++) {
			if (currentPiece.sprite[row][col] != null)
				currentPiece.sprite[row][col].destroy();
		}
	}
}

//Piece
function createPiece(game) {
	var piece = {};
	piece.name = nextPiece.name;
	// piece.name = "O";
	piece.shape = nextPiece.shape;
	piece.sprite = [];
	piece.x = 4;
	if (piece.name == 'I') piece.x = 3;
	piece.y = 0;
	piece.height = piece.shape.length;
	createNextPiece(game);

	for (var row = 0; row < piece.shape.length; row++) {
		piece.sprite[row] = [];
		for (var col = 0; col < piece.shape[row].length; col++) {
			//Add empty ceil
			if (!piece.shape[row][col]) piece.sprite[row].push(null);
			//Add sprite otherwise
			else {
				piece.sprite[row].push(
					game.add.sprite(
						(piece.x + 1.5 + col) * squareSize,
						(piece.y + 1.5 + row) * squareSize,
						piece.name
					)
				);
			}
		}
	}

	return piece;
}

function createNextPiece(game) {
	if (nextPiece != null && nextPiece.sprite != null) {
		for (var row = 0; row < nextPiece.height; row++) {
			for (var col = 0; col < nextPiece.sprite[row].length; col++) {
				if (nextPiece.sprite[row][col] != null)
					nextPiece.sprite[row][col].destroy();
			}
		}
	}
	var pieceKeys = Object.keys(tetriminos);
	nextPiece.name = pieceKeys[Math.floor(Math.random() * pieceKeys.length)];
	// nextPiece.name = 'O';
	nextPiece.shape = tetriminos[nextPiece.name];
	nextPiece.sprite = [];
	nextPiece.x = 12.5;
	nextPiece.y = 1;

	if (nextPiece.name == 'I') {
		nextPiece.x = 12;
		nextPiece.y = 1.5;
	} else if (nextPiece.name == 'O') nextPiece.x = 13;

	nextPiece.height = nextPiece.shape.length;

	for (var row = 0; row < nextPiece.shape.length; row++) {
		nextPiece.sprite[row] = [];
		for (var col = 0; col < nextPiece.shape[row].length; col++) {
			//Add empty ceil
			if (!nextPiece.shape[row][col]) nextPiece.sprite[row].push(null);
			//Add sprite otherwise
			else {
				nextPiece.sprite[row].push(
					game.add.sprite(
						(nextPiece.x + 1.5 + col) * squareSize,
						(nextPiece.y + 1.5 + row) * squareSize,
						nextPiece.name
					)
				);
			}
		}
	}
}

function setPieceOnGrid(scene) {
	for (var i = 0; i < currentPiece.shape.length; i++) {
		for (var j = 0; j < currentPiece.shape[i].length; j++) {
			if (currentPiece.shape[i][j] === 1) {
				grid[currentPiece.y + i][currentPiece.x + j] =
					currentPiece.sprite[i][j];
			}
		}
	}
	checkLines(scene);
}

function checkLines(scene) {
	var lineFull = true;
	var comboAlreadyInc = false;
	var clearedLinesAtOnce = 0;
	for (var i = gridHeight - 1; i >= 0; i--) {
		lineFull = true;
		//check if all ceill from row not null -> line full
		for (var j = 0; j < gridWidth; j++) {
			if (grid[i][j] == null) {
				lineFull = false;
				break;
			}
		}
		if (lineFull) {
			dropLinesFrom(i);
			i++;
			clearedLinesAtOnce++;
			speed();
			if (!comboAlreadyInc) {
				comboAlreadyInc = true;
				combo++;
			}
		}
	}
	//reset combo
	if (!comboAlreadyInc) {
		combo = 0;
		if (text_combo) dislayCombo(scene, false, 0, 0);
	} else {
		dislayCombo(scene, true, clearedLinesAtOnce, combo);
	}
	//inc score
	updateScore(clearedLinesAtOnce);
}

function isAllClear() {
	for (var row = 0; row < gridHeight; row++) {
		for (var col = 0; col < gridWidth; col++)
			if (grid[row][col] != null) return false;
	}
	return true;
}

function dropLinesFrom(index) {
	for (var j = 0; j < gridWidth; j++) grid[index][j].destroy();

	for (var i = index; i > 0; i--) {
		for (var j = 0; j < gridWidth; j++) {
			grid[i][j] = grid[i - 1][j];
			if (grid[i][j] != null) grid[i][j].y += squareSize;
		}
	}

	for (var j = 0; j < gridWidth; j++) grid[0][j] = null;
	nbr_of_lines_cleared++;
}

//Piece movement
function hardDrop() {
	while (!landed) {
		dropPiece();
	}
}

function dropPiece() {
	score++;
	if (currentPiece.y + currentPiece.height == gridHeight || collisionY()) {
		landed = true;
		return;
	}
	for (var row = 0; row < currentPiece.sprite.length; row++) {
		for (var col = 0; col < currentPiece.sprite[row].length; col++) {
			if (currentPiece.sprite[row][col] == null) continue;
			currentPiece.sprite[row][col].y += squareSize;
		}
	}
	currentPiece.y++;
}

function translationPiece(input) {
	//check borders
	if (
		(currentPiece.x == 0 && input == -1) ||
		(currentPiece.x + currentPiece.shape[0].length == gridWidth && input == 1)
	)
		return;

	//check if other piece on the way
	for (var row = 0; row < currentPiece.height; row++) {
		for (var col = 0; col < currentPiece.sprite[row].length; col++) {
			if (
				grid[currentPiece.y + row][currentPiece.x + input + col] != null &&
				currentPiece.shape[row][col] != 0
			)
				return;
		}
	}

	for (var row = 0; row < currentPiece.height; row++) {
		currentPiece.sprite[row].forEach((ceil) => {
			if (ceil == null) return;
			ceil.x += input * squareSize;
		});
	}
	currentPiece.x += input;
}

function rotatePiece(scene) {
	if (rotateShape() != 0) return;

	destroyPreviousSprites();

	currentPiece.sprite = [];
	for (var row = 0; row < currentPiece.height; row++) {
		currentPiece.sprite[row] = [];
		for (var col = 0; col < currentPiece.shape[row].length; col++) {
			if (currentPiece.shape[row][col])
				currentPiece.sprite[row].push(
					scene.add.sprite(
						(currentPiece.x + 1.5 + col) * squareSize,
						(currentPiece.y + 1.5 + row) * squareSize,
						currentPiece.name
					)
				);
			else currentPiece.sprite[row].push(null);
		}
	}
}

function destroyPreviousSprites() {
	for (var row = 0; row < currentPiece.sprite.length; row++) {
		for (var col = 0; col < currentPiece.sprite[row].length; col++) {
			if (currentPiece.sprite[row][col] != null)
				currentPiece.sprite[row][col].destroy();
		}
	}
}

function rotateShape() {
	var arrayRowNum = currentPiece.shape.length;
	var arrayColNum = currentPiece.shape[0].length;

	var newMatrix = Array.from({ length: arrayColNum }, () =>
		Array.from({ length: arrayRowNum }, () => 0)
	);

	for (var row = 0; row < arrayColNum; row++) {
		for (var col = 0; col < arrayRowNum; col++) {
			newMatrix[row][col] = currentPiece.shape[arrayRowNum - col - 1][row];
		}
	}

	for (var row = 0; row < newMatrix.length; row++) {
		for (var col = 0; col < newMatrix[row].length; col++) {
			if (newMatrix[row][col]) {
				if (
					currentPiece.y + row >= gridHeight ||
					currentPiece.x + col < 0 ||
					currentPiece.x + col >= gridWidth
				)
					return -1;
				if (grid[currentPiece.y + row][currentPiece.x + col] != null)
					return -1;
			}
		}
	}

	currentPiece.shape = newMatrix;
	currentPiece.height = arrayColNum;
	return 0;
}

function collisionY() {
	for (var row = 0; row < currentPiece.height; row++) {
		for (var col = 0; col < currentPiece.sprite[row].length; col++) {
			if (currentPiece.sprite[row][col] == null) continue;

			if (grid[currentPiece.y + row + 1][currentPiece.x + col] != null)
				return true;
		}
	}

	return false;
}

function speed() {
	nbr_lines_since_last_lvl++;
	if (nbr_lines_since_last_lvl == NUMBER_OF_LINES_PER_LVL) {
		lvl++;
		lvl_since_last_increase++;
		if (lvl_since_last_increase == lvl_speed[efficient_lvl].lvl) {
			efficient_lvl++;
			lvl_since_last_increase = 0;
			timer.delay = (lvl_speed[efficient_lvl].interval / 60) * 1000;
		}
		nbr_lines_since_last_lvl = 0;
	}
}
